/**
 * OpenAI API 格式 → Claude 格式 转换器
 */

/**
 * 转换 OpenAI 响应到 Claude 格式
 * @param {Object} openaiRes - OpenAI API 响应
 * @param {string} model - 模型名称
 * @returns {Object} Claude 格式响应
 */
export function openAIToClaude(openaiRes, model = 'deepseek-chat') {
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

  // 文本内容
  if (choice.message?.content) {
    content.push({
      type: 'text',
      text: choice.message.content
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
 * 映射 stop 原因
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
 * 解析 tool input
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
 * 生成消息 ID
 */
function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
