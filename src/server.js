/**
 * DeepSeek Adapter Server
 * 提供 Anthropic 兼容 API
 */

import express from 'express';
import chalk from 'chalk';
import { claudeToOpenAI, mapModelName, MODEL_MAPPING } from './converters/request.js';
import { openAIToClaude } from './converters/response.js';
import { StreamConverter, formatSSE } from './converters/stream.js';

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';

/**
 * 启动代理服务器
 */
export async function startServer(config) {
  const { port, host, apiKey, model } = config;

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // 请求日志中间件
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(chalk.gray(`[${timestamp}]`) + chalk.white(` ${req.method}`) + chalk.cyan(` ${req.path}`));
    next();
  });

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', model, provider: 'deepseek' });
  });

  // 模型列表 - 返回所有支持的 Claude 模型别名
  app.get('/v1/models', (req, res) => {
    const claudeModels = Object.keys(MODEL_MAPPING);

    // DeepSeek 原生模型
    const deepseekModels = [
      model,
      'deepseek-chat',
      'deepseek-reasoner',
    ];

    const allModels = [
      ...claudeModels.map(id => ({
        id,
        object: 'model',
        owned_by: 'anthropic',
        description: `Mapped to: ${MODEL_MAPPING[id]}`
      })),
      ...deepseekModels.map(id => ({ id, object: 'model', owned_by: 'deepseek' })),
    ];

    res.json({ data: allModels });
  });

  // 调试端点 - 测试模型映射
  app.get('/debug/model-mapping', (req, res) => {
    const requestedModel = req.query.model || 'claude-opus-4-6[1m]';
    const result = mapModelName(requestedModel);

    res.json({
      requested_model: requestedModel,
      mapped_model: result,
      model_mapping: MODEL_MAPPING,
      timestamp: new Date().toISOString()
    });
  });

  // 调试端点 - 测试 DeepSeek API 连接
  app.get('/debug/test-api', async (req, res) => {
    try {
      const testReq = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      };

      const response = await fetch(DEEPSEEK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(testReq),
      });

      const responseText = await response.text();

      res.json({
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText.substring(0, 1000)
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        stack: error.stack
      });
    }
  });

  // 主 API 端点 - Anthropic 兼容
  app.post('/v1/messages', async (req, res) => {
    try {
      const claudeReq = req.body;

      // 使用 mapModelName 获取实际模型
      const requestedModel = claudeReq.model || 'claude-opus-4-6';
      const actualModel = mapModelName(requestedModel);

      // 更新请求中的模型
      const openaiReq = claudeToOpenAI({
        ...claudeReq,
        model: actualModel
      });

      // 调用 DeepSeek API
      const response = await fetch(DEEPSEEK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openaiReq),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(chalk.red(`DeepSeek API error: ${response.status} - ${errorText}`));
        return res.status(response.status).json({
          type: 'error',
          error: {
            type: 'api_error',
            message: `DeepSeek API error: ${response.status} - ${errorText}`
          }
        });
      }

      // 处理响应
      if (claudeReq.stream) {
        // 流式响应
        await handleStreamResponse(response, res, actualModel, requestedModel);
      } else {
        // 非流式响应
        const data = await response.json();
        const claudeRes = openAIToClaude(data, actualModel);
        // 保留原始请求的模型名
        claudeRes.model = requestedModel;
        res.json(claudeRes);
      }

    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      res.status(500).json({
        type: 'error',
        error: {
          type: 'internal_error',
          message: error.message
        }
      });
    }
  });

  // 启动服务器
  app.listen(port, host, () => {
    console.log(chalk.green.bold('\n✓ Server started successfully!\n'));
    console.log(chalk.white('  Endpoint: ') + chalk.cyan(`http://${host}:${port}/v1`));
    console.log(chalk.white('  Health:   ') + chalk.cyan(`http://${host}:${port}/health`));
    console.log(chalk.white('  Debug:    ') + chalk.cyan(`http://${host}:${port}/debug/model-mapping`));
    console.log();
    console.log(chalk.white('  Configuration:'));
    console.log(chalk.gray(`    MODEL env var: ${process.env.MODEL || 'not set (will use default: deepseek-reasoner)'}`));
    console.log(chalk.gray(`    Config model:  ${model}`));
    console.log(chalk.gray(`    API Key:       ${apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET!'}`));
    console.log();
    console.log(chalk.yellow('  Press Ctrl+C to stop'));
    console.log();
  });
}

/**
 * 处理流式响应
 */
async function handleStreamResponse(deepseekResponse, res, actualModel, requestedModel) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const converter = new StreamConverter(actualModel);
  const reader = deepseekResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const chunk = JSON.parse(data);
            const events = converter.convertChunk(chunk);

            for (const event of events) {
              // 更新 message_start 中的模型名称为用户请求的模型名
              if (event.type === 'message_start' && event.message) {
                event.message.model = requestedModel;
              }
              res.write(formatSSE(event));
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`Stream error: ${error.message}`));
  } finally {
    res.end();
  }
}
