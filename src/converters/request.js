/**
 * Claude API 格式 → OpenAI 格式 转换器
 */

/**
 * Claude 模型名称 → DeepSeek 模型名称 映射
 */
const MODEL_MAPPING = {
  // Claude 4.6 系列
  'claude-opus-4-6': 'deepseek-reasoner',
  'claude-opus-4-6-1m': 'deepseek-reasoner',
  'claude-sonnet-4-6': 'deepseek-chat',
  'claude-sonnet-4-6-1m': 'deepseek-chat',
  'claude-haiku-4-5': 'deepseek-chat',

  // Claude 4 系列
  'claude-opus-4': 'deepseek-reasoner',
  'claude-sonnet-4': 'deepseek-chat',
  'claude-haiku-4': 'deepseek-chat',

  // Claude 3.5 系列
  'claude-3-5-sonnet': 'deepseek-chat',
  'claude-3-5-haiku': 'deepseek-chat',

  // Claude 3 系列
  'claude-3-opus': 'deepseek-reasoner',
  'claude-3-sonnet': 'deepseek-chat',
  'claude-3-haiku': 'deepseek-chat',

  // 默认映射
  'default': 'deepseek-chat'
};

/**
 * 获取映射后的模型名称
 * @param {string} claudeModel - Claude 模型名称
 * @returns {string} DeepSeek 模型名称
 */
export function mapModelName(claudeModel) {
  if (!claudeModel) return MODEL_MAPPING['default'];

  // 移除可能的方括号后缀 (如 [1m])
  const baseModel = claudeModel.replace(/\[.*?\]$/, '');

  // 直接匹配
  if (MODEL_MAPPING[baseModel]) {
    return MODEL_MAPPING[baseModel];
  }

  // 模糊匹配（处理版本号差异）
  for (const [key, value] of Object.entries(MODEL_MAPPING)) {
    if (baseModel.startsWith(key) || key.startsWith(baseModel)) {
      return value;
    }
  }

  // 包含 opus → deepseek-reasoner
  if (baseModel.includes('opus')) return 'deepseek-reasoner';
  // 包含 sonnet → deepseek-chat
  if (baseModel.includes('sonnet')) return 'deepseek-chat';
  // 包含 haiku → deepseek-chat
  if (baseModel.includes('haiku')) return 'deepseek-chat';

  // 默认使用配置的模型或 deepseek-chat
  return process.env.MODEL || MODEL_MAPPING['default'];
}

/**
 * 转换 Claude 消息格式到 OpenAI 格式
 * @param {Object} claudeReq - Claude API 请求体
 * @returns {Object} OpenAI 格式请求体
 */
export function claudeToOpenAI(claudeReq) {
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
    const converted = convertMessage(msg);
    messages.push(converted);
  }

  // 映射模型名称
  const deepseekModel = mapModelName(claudeReq.model);

  // 构建 OpenAI 请求
  const openaiReq = {
    model: deepseekModel,
    messages,
    max_tokens: claudeReq.max_tokens || 4096,
    temperature: claudeReq.temperature || 0.7,
    stream: claudeReq.stream || false,
  };

  // 处理 tools
  if (claudeReq.tools && claudeReq.tools.length > 0) {
    openaiReq.tools = convertTools(claudeReq.tools);
    openaiReq.tool_choice = claudeReq.tool_choice ? convertToolChoice(claudeReq.tool_choice) : 'auto';
  }

  return openaiReq;
}

/**
 * 转换单条消息
 */
function convertMessage(msg) {
  const role = msg.role;

  // 简单字符串内容
  if (typeof msg.content === 'string') {
    return { role, content: msg.content };
  }

  // 数组格式内容
  if (Array.isArray(msg.content)) {
    const textParts = [];
    const images = [];
    const toolUses = [];
    const toolResults = [];

    for (const block of msg.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      } else if (block.type === 'image') {
        // Claude: { type: 'image', source: { data, media_type } }
        // OpenAI: { type: 'image_url', image_url: { url: 'data:...' } }
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

    // 构建内容
    if (toolUses.length > 0) {
      // Tool 调用消息
      return {
        role,
        content: textParts.join('\n') || null,
        tool_calls: toolUses
      };
    } else if (toolResults.length > 0) {
      // Tool 结果消息
      return {
        role: 'tool',
        content: typeof toolResults[0].content === 'string'
          ? toolResults[0].content
          : JSON.stringify(toolResults[0].content),
        tool_call_id: toolResults[0].tool_call_id
      };
    } else if (images.length > 0 && textParts.length > 0) {
      // 多模态消息
      return {
        role,
        content: [
          { type: 'text', text: textParts.join('\n') },
          ...images
        ]
      };
    } else if (images.length > 0) {
      return { role, content: images };
    } else {
      return { role, content: textParts.join('\n') };
    }
  }

  return { role, content: '' };
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
