/**
 * deepseek-adapter 类型定义
 *
 * 使用 DeepSeek 模型与 Claude Code - Anthropic 兼容 API 适配器
 */

/**
 * 服务器配置选项
 */
export interface ServerConfig {
  /** 服务器端口 (默认: 3000) */
  port?: number;
  /** 服务器主机 (默认: 'localhost') */
  host?: string;
  /** DeepSeek API Key (必需) */
  apiKey: string;
  /** 默认模型 (默认: 'deepseek-chat') */
  model?: string;
}

/**
 * Claude 模型名称映射表
 */
export interface ModelMapping {
  [key: string]: string;
}

/**
 * Claude 消息内容块 - 文本
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

/**
 * Claude 消息内容块 - 图片
 */
export interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'url' | 'base64';
    media_type?: string;
    data?: string;
    url?: string;
  };
}

/**
 * Claude 消息内容块 - 工具使用
 */
export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Claude 消息内容块 - 工具结果
 */
export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Record<string, unknown>;
}

/**
 * Claude 消息内容块类型
 */
export type ContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

/**
 * Claude 消息
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Claude 工具定义
 */
export interface ClaudeTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

/**
 * Claude API 请求
 */
export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages?: ClaudeMessage[];
  system?: string | Array<{ text: string; type: string }>;
  temperature?: number;
  stream?: boolean;
  tools?: ClaudeTool[];
  tool_choice?: ToolChoice;
}

/**
 * 工具选择选项
 */
export type ToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string };

/**
 * OpenAI 消息
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

/**
 * OpenAI 工具定义
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * OpenAI API 请求
 */
export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * Claude API 响应
 */
export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence';
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * OpenAI API 响应
 */
export interface OpenAIResponse {
  id?: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

/**
 * 流式事件类型
 */
export type StreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop';

/**
 * 流式事件
 */
export interface StreamEvent {
  type: StreamEventType;
  message?: {
    id: string;
    type: string;
    role: string;
    content: unknown[];
    model: string;
    stop_reason: string | null;
    usage: { input_tokens: number; output_tokens: number };
  };
  index?: number;
  content_block?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };
  delta?: { type: string; text?: string; stop_reason?: string; stop_sequence?: string | null; partial_json?: string };
  usage?: { output_tokens: number };
}

/**
 * 流式转换器类
 */
export declare class StreamConverter {
  constructor(model?: string);
  convertChunk(chunk: OpenAIResponse): StreamEvent[];
}

/**
 * 启动代理服务器
 *
 * @example
 * ```ts
 * import { startServer } from 'deepseek-adapter';
 *
 * await startServer({
 *   apiKey: 'your-deepseek-api-key',
 *   port: 3000,
 *   host: 'localhost'
 * });
 * ```
 */
export declare function startServer(config: ServerConfig): Promise<void>;

/**
 * Claude 模型名称映射表
 *
 * @example
 * ```ts
 * import { MODEL_MAPPING } from 'deepseek-adapter';
 *
 * console.log(MODEL_MAPPING['claude-opus-4-6']); // 'deepseek-reasoner'
 * ```
 */
export declare const MODEL_MAPPING: ModelMapping;

/**
 * 获取映射后的模型名称
 *
 * @param claudeModel - Claude 模型名称
 * @returns DeepSeek 模型名称
 *
 * @example
 * ```ts
 * import { mapModelName } from 'deepseek-adapter';
 *
 * const model = mapModelName('claude-opus-4-6'); // 'deepseek-reasoner'
 * ```
 */
export declare function mapModelName(claudeModel: string): string;

/**
 * 转换 Claude API 请求格式到 OpenAI 格式
 *
 * @param claudeReq - Claude API 请求体
 * @returns OpenAI 格式请求体
 * @throws {TypeError} 如果 claudeReq 不是有效对象
 *
 * @example
 * ```ts
 * import { claudeToOpenAI } from 'deepseek-adapter';
 *
 * const openaiReq = claudeToOpenAI({
 *   model: 'claude-opus-4-6',
 *   max_tokens: 4096,
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 * ```
 */
export declare function claudeToOpenAI(claudeReq: ClaudeRequest): OpenAIRequest;

/**
 * 转换 OpenAI API 响应格式到 Claude 格式
 *
 * @param openaiRes - OpenAI API 响应体
 * @param model - 模型名称 (默认: 'deepseek-chat')
 * @returns Claude 格式响应体
 *
 * @example
 * ```ts
 * import { openAIToClaude } from 'deepseek-adapter';
 *
 * const claudeRes = openAIToClaude(openaiResponse, 'deepseek-chat');
 * ```
 */
export declare function openAIToClaude(openaiRes: OpenAIResponse, model?: string): ClaudeResponse;

/**
 * 将事件格式化为 SSE (Server-Sent Events) 字符串
 *
 * @param event - 流式事件对象
 * @returns SSE 格式字符串
 *
 * @example
 * ```ts
 * import { formatSSE } from 'deepseek-adapter';
 *
 * const sse = formatSSE({ type: 'message_stop' });
 * // "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"
 * ```
 */
export declare function formatSSE(event: StreamEvent): string;

/**
 * 转换器子模块导出
 */
export {
  claudeToOpenAI,
  MODEL_MAPPING,
  mapModelName
} from './converters/request.js';

export {
  openAIToClaude
} from './converters/response.js';

export {
  StreamConverter,
  formatSSE
} from './converters/stream.js';
