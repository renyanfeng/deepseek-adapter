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
 * @param {string} claudeModel - Claude 模型名称
 * @returns {string} DeepSeek 模型名称
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
 * 转换 Claude 消息格式到 OpenAI 格式
 * @param {Object} claudeReq - Claude API 请求体
 * @returns {Object} OpenAI 格式请求体
 */
export function claudeToOpenAI(claudeReq) {
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
 * @param {Object} msg - 消息对象
 * @param {boolean} isReasoner - 是否使用推理模型
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
 * 转换 Tools 格式
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
 * 转换 tool_choice
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
