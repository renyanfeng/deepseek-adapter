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
    // 使用已导入的 MODEL_MAPPING
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

    console.log(`\n🔍 [DEBUG] Model mapping debug request for: ${requestedModel}`);

    const result = mapModelName(requestedModel);

    const response = {
      requested_model: requestedModel,
      mapped_model: result,
      model_mapping: MODEL_MAPPING,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ [DEBUG] Mapping result:`, response);
    res.json(response);
  });

  // 主 API 端点 - Anthropic 兼容
  app.post('/v1/messages', async (req, res) => {
    try {
      const claudeReq = req.body;
      console.log(chalk.blue('\n📨 [DEBUG] Received request:'));
      console.log(chalk.blue(`  Method: POST /v1/messages`));
      console.log(chalk.blue(`  Model requested: ${claudeReq.model || 'default'}`));
      console.log(chalk.blue(`  Stream: ${claudeReq.stream || false}`));

      // 使用 mapModelName 获取实际模型
      const requestedModel = claudeReq.model || 'claude-opus-4-6';
      const actualModel = mapModelName(requestedModel);

      console.log(chalk.yellow(`  [DEBUG] Model mapping:`));
      console.log(chalk.yellow(`    Model '${requestedModel}' → '${actualModel}'`));
      console.log(chalk.yellow(`    MODEL_MAPPING: ${JSON.stringify(MODEL_MAPPING, null, 2)}`));

      // 更新请求中的模型
      const openaiReq = claudeToOpenAI({
        ...claudeReq,
        model: actualModel
      });

      console.log(chalk.blue('  → Converting request...'));
      console.log(chalk.gray(`    Requested: ${requestedModel}`));
      console.log(chalk.gray(`    Using: ${actualModel}`));
      console.log(chalk.blue(`  [DEBUG] OpenAI request body (partial):`));
      console.log(chalk.gray(`    model: ${openaiReq.model}`));
      console.log(chalk.gray(`    messages: ${openaiReq.messages.length} items`));
      console.log(chalk.gray(`    max_tokens: ${openaiReq.max_tokens}`));
      console.log(chalk.gray(`    temperature: ${openaiReq.temperature}`));

      // 调用 DeepSeek API
      console.log(chalk.blue('  [DEBUG] Calling DeepSeek API...'));
      const startTime = Date.now();

      const response = await fetch(DEEPSEEK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openaiReq),
      });

      const apiDuration = Date.now() - startTime;
      console.log(chalk.blue(`  [DEBUG] API call completed in ${apiDuration}ms`));
      console.log(chalk.blue(`  [DEBUG] API response status: ${response.status}`));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(chalk.red(`  ✗ DeepSeek API error: ${response.status}`));
        console.error(chalk.red(`    ${errorText}`));
        console.error(chalk.red(`  [DEBUG] Full error response:`, errorText));
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
        console.log(chalk.blue('  [DEBUG] Processing non-stream response...'));
        const data = await response.json();
        console.log(chalk.blue(`  [DEBUG] DeepSeek response data (partial):`));
        console.log(chalk.gray(`    model: ${data.model}`));
        console.log(chalk.gray(`    usage: ${JSON.stringify(data.usage)}`));
        console.log(chalk.gray(`    choices: ${data.choices.length} items`));

        const claudeRes = openAIToClaude(data, actualModel);
        // 保留原始请求的模型名
        claudeRes.model = requestedModel;
        console.log(chalk.green('  ← Response sent'));
        console.log(chalk.blue(`  [DEBUG] Final Claude response model: ${claudeRes.model}`));
        res.json(claudeRes);
      }

    } catch (error) {
      console.error(chalk.red(`  ✗ Error: ${error.message}`));
      console.error(chalk.red(`  [DEBUG] Error stack:`, error.stack));
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
