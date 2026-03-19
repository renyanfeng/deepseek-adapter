/**
 * DeepSeek Adapter Server
 * 提供 Anthropic 兼容 API
 */

import express from 'express';
import chalk from 'chalk';
import { claudeToOpenAI, mapModelName } from './converters/request.js';
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
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version');
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
    // 导入 MODEL_MAPPING
    const { MODEL_MAPPING } = require('./converters/request.js');
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

      console.log(chalk.blue('  → Converting request...'));
      console.log(chalk.gray(`    Requested: ${requestedModel}`));
      console.log(chalk.gray(`    Using: ${actualModel}`));

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
        console.error(chalk.red(`  ✗ DeepSeek API error: ${response.status}`));
        console.error(chalk.red(`    ${errorText}`));
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
        console.log(chalk.green('  ← Streaming response...'));
        await handleStreamResponse(response, res, actualModel, requestedModel);
      } else {
        // 非流式响应
        const data = await response.json();
        const claudeRes = openAIToClaude(data, actualModel);
        // 保留原始请求的模型名
        claudeRes.model = requestedModel;
        console.log(chalk.green('  ← Response sent'));
        res.json(claudeRes);
      }

    } catch (error) {
      console.error(chalk.red(`  ✗ Error: ${error.message}`));
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
          if (data === '[DONE]') {
            continue;
          }

          try {
            const chunk = JSON.parse(data);
            // 在消息开始时添加模型信息
            if (chunk.type === 'message_start' && chunk.message) {
              chunk.message.model = requestedModel;
            }
            const events = converter.convertChunk(chunk);

            for (const event of events) {
              res.write(formatSSE(event));
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`  Stream error: ${error.message}`));
  } finally {
    res.end();
  }
}
