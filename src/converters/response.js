/**
 * OpenAI API 格式 → Claude 格式 转换器
 */

/**
 * 转换 OpenAI API 响应格式到 Claude 格式
 *
 * 将 DeepSeek (OpenAI) API 的响应格式转换为 Anthropic Claude 兼容格式。
 * 处理文本内容、工具调用、使用量统计等。
 *
 * @param {Object} openaiRes - OpenAI API 响应体
 * @param {string} [model='deepseek-chat'] - 模型名称
 * @returns {Object} Claude 格式响应体
 * @throws {TypeError} 如果 openaiRes 不是有效对象
 *
 * @example
 * openAIToClaude({
 *   id: 'chatcmpl-123',
 *   choices: [{
 *     message: { role: 'assistant', content: 'Hello!' },
 *     finish_reason: 'stop'
 *   }],
 *   usage: { prompt_tokens: 10, completion_tokens: 5 }
 * }, 'deepseek-chat');
 */
export function openAIToClaude(openaiRes, model = 'deepseek-chat') {
  if (!openaiRes || typeof openaiRes !== 'object') {
    throw new TypeError('openaiRes must be an object');
  }

  const choice = openaiRes.choices?.[0];

  if (!choice) {
    return {
      id: generateId(),
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      model,
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 }
    };
  }

  // 构建 content
  const content = [];

  // 文本内容（DeepSeek Reasoner 使用 reasoning_content）
  const textContent = choice.message?.reasoning_content || choice.message?.content;
  if (textContent) {
    content.push({
      type: 'text',
      text: textContent
    });
  }

  // Tool 调用
  if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
    for (const toolCall of choice.message.tool_calls) {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function?.name,
        input: parseToolInput(toolCall.function?.arguments)
      });
    }
  }

  // 确定 stop_reason
  const stopReason = mapStopReason(choice.finish_reason, choice.message?.tool_calls);

  return {
    id: openaiRes.id || generateId(),
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openaiRes.usage?.prompt_tokens || 0,
      output_tokens: openaiRes.usage?.completion_tokens || 0
    }
  };
}

/**
 * 映射 OpenAI finish_reason 到 Claude stop_reason
 *
 * @param {string} finishReason - OpenAI 完成原因 ('stop' | 'length' | 'tool_calls')
 * @param {Array} [toolCalls] - 工具调用数组（如果有，返回 'tool_use'）
 * @returns {string} Claude stop_reason ('end_turn' | 'max_tokens' | 'tool_use')
 */
function mapStopReason(finishReason, toolCalls) {
  if (toolCalls && toolCalls.length > 0) {
    return 'tool_use';
  }

  switch (finishReason) {
    case 'stop':
      return 'end_turn';
    case 'tool_calls':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    default:
      return 'end_turn';
  }
}

/**
 * 解析工具调用参数
 *
 * 尝试将 JSON 字符串解析为对象，如果解析失败则返回原始字符串。
 *
 * @param {string} args - JSON 字符串格式的参数
 * @returns {Object} 解析后的参数对象
 */
function parseToolInput(args) {
  if (!args) return {};

  try {
    return JSON.parse(args);
  } catch {
    return { raw: args };
  }
}

/**
 * 生成唯一的消息 ID
 *
 * @returns {string} 格式为 `msg_{timestamp}_{random}` 的唯一 ID
 */
function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
