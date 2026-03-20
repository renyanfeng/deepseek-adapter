/**
 * Claude API 格式 → OpenAI 格式 转换器
 */

/**
 * Claude 模型名称 → DeepSeek 模型名称 映射
 */
export const MODEL_MAPPING = {
  'default': 'deepseek-reasoner',
  // Claude 4.6 系列
  'claude-opus-4-6': 'deepseek-reasoner',
  'claude-opus-4-6[1m]': 'deepseek-reasoner',
  'claude-sonnet-4-6': 'deepseek-chat',
  'claude-sonnet-4-6[1m]': 'deepseek-chat',
  'claude-haiku-4-5-20251001': 'deepseek-chat',
  // Claude 4.5 系列
  'claude-opus-4-5': 'deepseek-reasoner',
  'claude-opus-4-5[1m]': 'deepseek-reasoner',
  'claude-sonnet-4-5': 'deepseek-chat',
  'claude-sonnet-4-5[1m]': 'deepseek-chat',
  'claude-haiku-4-5': 'deepseek-chat',
  'claude-haiku-4-5[1m]': 'deepseek-chat',
  // Claude 3.7 系列 (旧版兼容)
  'claude-3-7-sonnet': 'deepseek-chat',
  'claude-3-7-sonnet[1m]': 'deepseek-chat',
  'claude-3-5-sonnet': 'deepseek-chat',
  'claude-3-5-sonnet[1m]': 'deepseek-chat',
  'claude-3-5-haiku': 'deepseek-chat',
  'claude-3-5-haiku[1m]': 'deepseek-chat',
  'claude-3-opus': 'deepseek-reasoner',
  'claude-3-opus[1m]': 'deepseek-reasoner',
};

/**
 * 获取映射后的模型名称
 *
 * 如果设置了环境变量 MODEL，则优先使用环境变量；
 * 否则根据映射表将 Claude 模型名映射到对应的 DeepSeek 模型。
 *
 * @param {string} claudeModel - Claude 模型名称 (如: 'claude-opus-4-6')
 * @returns {string} DeepSeek 模型名称 ('deepseek-chat' 或 'deepseek-reasoner')
 *
 * @example
 * // 使用环境变量 MODEL
 * process.env.MODEL = 'deepseek-chat';
 * mapModelName('claude-opus-4-6'); // 'deepseek-chat'
 *
 * @example
 * // 使用映射表
 * mapModelName('claude-opus-4-6'); // 'deepseek-reasoner'
 * mapModelName('claude-sonnet-4-6'); // 'deepseek-chat'
 */
export function mapModelName(claudeModel) {
  // 如果设置了环境变量 MODEL，优先使用
  if (process.env.MODEL) {
    return process.env.MODEL;
  }

  // 否则使用映射表
  return MODEL_MAPPING[claudeModel] || MODEL_MAPPING['default'] || 'deepseek-reasoner';
}

/**
 * 转换 Claude API 请求格式到 OpenAI 格式
 *
 * 将 Anthropic Claude API 的请求格式转换为兼容 DeepSeek (OpenAI) 的格式。
 * 处理消息格式、工具调用、模型参数等的转换。
 *
 * @param {Object} claudeReq - Claude API 请求体
 * @param {string} claudeReq.model - Claude 模型名称
 * @param {number} [claudeReq.max_tokens] - 最大生成 token 数
 * @param {Array} [claudeReq.messages] - 消息数组
 * @param {string|Array} [claudeReq.system] - 系统提示词
 * @param {number} [claudeReq.temperature] - 温度参数
 * @param {boolean} [claudeReq.stream] - 是否流式响应
 * @param {Array} [claudeReq.tools] - 工具定义数组
 * @param {Object} [claudeReq.tool_choice] - 工具选择策略
 * @returns {Object} OpenAI 格式请求体
 * @throws {TypeError} 如果 claudeReq 不是有效对象
 *
 * @example
 * claudeToOpenAI({
 *   model: 'claude-opus-4-6',
 *   max_tokens: 4096,
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 * // => { model: 'deepseek-reasoner', messages: [...], max_tokens: 4096, stream: false }
 */
export function claudeToOpenAI(claudeReq) {
  if (!claudeReq || typeof claudeReq !== 'object') {
    throw new TypeError('claudeReq must be an object');
  }

  const deepseekModel = mapModelName(claudeReq.model);
  const isReasoner = deepseekModel === 'deepseek-reasoner';

  const messages = [];

  // 处理 system 消息
  if (claudeReq.system) {
    messages.push({
      role: 'system',
      content: typeof claudeReq.system === 'string'
        ? claudeReq.system
        : claudeReq.system.map(s => s.text).join('\n')
    });
  }

  // 处理 messages
  for (const msg of claudeReq.messages || []) {
    const converted = convertMessage(msg, isReasoner);
    // convertMessage 可能返回数组（多个 tool results）或单个消息
    if (Array.isArray(converted)) {
      messages.push(...converted);
    } else {
      messages.push(converted);
    }
  }

  // 构建 OpenAI 请求
  // deepseek-reasoner 最大上下文 131072，需要为消息预留空间
  // 限制 max_tokens 最大为 8192，避免超出上下文限制
  let maxTokens = claudeReq.max_tokens || 4096;
  if (isReasoner && maxTokens > 8192) {
    maxTokens = 8192;
  }

  const openaiReq = {
    model: deepseekModel,
    messages,
    max_tokens: maxTokens,
    stream: claudeReq.stream || false,
  };

  // DeepSeek Reasoner 不支持 temperature 等参数
  if (!isReasoner) {
    openaiReq.temperature = claudeReq.temperature || 0.7;
  }

  // 处理 tools
  if (claudeReq.tools && claudeReq.tools.length > 0) {
    openaiReq.tools = convertTools(claudeReq.tools);
    openaiReq.tool_choice = claudeReq.tool_choice ? convertToolChoice(claudeReq.tool_choice) : 'auto';
  }

  return openaiReq;
}

/**
 * 转换单条消息
 *
 * 处理各种消息格式：简单文本、数组格式内容、工具调用、工具结果等。
 * 对于 DeepSeek Reasoner 模型，assistant 消息需要包含 reasoning_content 字段。
 *
 * @param {Object} msg - 消息对象
 * @param {string} msg.role - 消息角色 ('user' | 'assistant' | 'system' | 'tool')
 * @param {string|Array} msg.content - 消息内容（字符串或内容块数组）
 * @param {Array} [msg.tool_calls] - 工具调用数组
 * @param {string} [msg.tool_call_id] - 工具调用 ID
 * @param {string} [msg.reasoning_content] - 推理内容（用于 Reasoner 模型）
 * @param {boolean} [isReasoner=false] - 是否使用推理模型
 * @returns {Object|Object[]} OpenAI 格式消息（可能返回数组，用于多个 tool result）
 */
function convertMessage(msg, isReasoner = false) {
  const role = msg.role;

  // 检查是否已经是转换过的消息（包含 tool_calls 字段）
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    const message = {
      role,
      content: msg.content,
      tool_calls: msg.tool_calls
    };
    // DeepSeek Reasoner 要求 assistant 消息包含 reasoning_content
    if (isReasoner && role === 'assistant') {
      message.reasoning_content = msg.reasoning_content || msg.content || '';
    }
    return message;
  }

  // 检查是否已经是 tool 角色消息（包含 tool_call_id）
  if (msg.tool_call_id) {
    return {
      role: 'tool',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      tool_call_id: msg.tool_call_id
    };
  }

  // 简单字符串内容
  if (typeof msg.content === 'string') {
    const message = { role, content: msg.content };
    // DeepSeek Reasoner 要求 assistant 消息包含 reasoning_content 字段
    if (isReasoner && role === 'assistant') {
      message.reasoning_content = msg.content || '';
    }
    return message;
  }

  // 数组格式内容（Claude 格式）
  if (Array.isArray(msg.content)) {
    const textParts = [];
    const images = [];
    const toolUses = [];
    const toolResults = [];

    for (const block of msg.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'image') {
        const imageUrl = block.source?.data
          ? `data:${block.source.media_type || 'image/png'};base64,${block.source.data}`
          : block.source?.url || '';
        images.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      } else if (block.type === 'tool_use') {
        toolUses.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
      } else if (block.type === 'tool_result') {
        toolResults.push({
          tool_call_id: block.tool_use_id,
          content: block.content
        });
      }
    }

    // 构建 Tool 调用消息
    if (toolUses.length > 0) {
      const content = textParts.join('\n') || '';
      const message = {
        role: 'assistant',
        content: content || null,
        tool_calls: toolUses
      };
      // DeepSeek Reasoner 要求：assistant 消息必须包含 reasoning_content
      if (isReasoner) {
        message.reasoning_content = content || '';
      }
      return message;
    }

    // 构建 Tool 结果消息
    if (toolResults.length > 0) {
      // 可以有多个 tool results
      return toolResults.map(tr => ({
        role: 'tool',
        content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
        tool_call_id: tr.tool_call_id
      }));
    }

    // 多模态消息 - DeepSeek 不支持图片，只保留文本
    if (images.length > 0) {
      return { role, content: textParts.join('\n') || '' };
    }

    // 纯文本消息
    return { role, content: textParts.join('\n') };
  }

  // 默认情况
  const message = { role, content: '' };
  if (isReasoner && role === 'assistant') {
    message.reasoning_content = '';
  }
  return message;
}

/**
 * 转换 Claude Tools 格式到 OpenAI 格式
 *
 * @param {Array<Object>} claudeTools - Claude 工具定义数组
 * @param {string} claudeTools[].name - 工具名称
 * @param {string} [claudeTools[].description] - 工具描述
 * @param {Object} claudeTools[].input_schema - 输入参数 JSON Schema
 * @returns {Array<Object>} OpenAI 格式工具定义数组
 */
function convertTools(claudeTools) {
  return claudeTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema || {}
    }
  }));
}

/**
 * 转换 Claude tool_choice 到 OpenAI 格式
 *
 * @param {Object} choice - Claude tool_choice 配置
 * @param {string} choice.type - 选择类型 ('auto' | 'any' | 'tool')
 * @param {string} [choice.name] - 当 type='tool' 时指定的工具名称
 * @returns {string|Object} OpenAI 格式 tool_choice ('auto' | 'required' | { type, function })
 */
function convertToolChoice(choice) {
  if (choice.type === 'auto') return 'auto';
  if (choice.type === 'any') return 'required';
  if (choice.type === 'tool') {
    return {
      type: 'function',
      function: { name: choice.name }
    };
  }
  return 'auto';
}
