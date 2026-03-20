/**
 * deepseek-adapter
 *
 * 使用 DeepSeek 模型与 Claude Code
 *
 * 用法:
 *   import { startServer } from 'deepseek-adapter';
 *   await startServer({ apiKey: 'YOUR_KEY', port: 3000 });
 */

export { startServer } from './server.js';
export { claudeToOpenAI, openAIToClaude, MODEL_MAPPING, mapModelName, StreamConverter, formatSSE } from './converters/index.js';
