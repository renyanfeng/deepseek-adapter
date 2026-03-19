/**
 * 流式响应转换器
 * OpenAI SSE → Claude SSE
 */

/**
 * 流式响应状态管理
 */
export class StreamConverter {
  constructor(model = 'deepseek-chat') {
    this.model = model;
    this.messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.contentIndex = 0;
    this.toolCallIndex = 0;
    this.currentToolCalls = new Map();
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.hasStarted = false;
  }

  /**
   * 生成消息开始事件
   */
  generateMessageStart() {
    return {
      type: 'message_start',
      message: {
        id: this.messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: this.model,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    };
  }

  /**
   * 生成内容块开始事件
   */
  generateContentBlockStart(blockType, index) {
    if (blockType === 'text') {
      return {
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '' }
      };
    } else if (blockType === 'tool_use') {
      return {
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: '', name: '', input: {} }
      };
    }
  }

  /**
   * 转换 OpenAI 流式数据块
   */
  convertChunk(chunk) {
    const events = [];

    // 发送消息开始（首次）
    if (!this.hasStarted) {
      events.push(this.generateMessageStart());
      this.hasStarted = true;
    }

    const delta = chunk.choices?.[0]?.delta;
    const finishReason = chunk.choices?.[0]?.finish_reason;

    if (!delta && !finishReason) {
      return events;
    }

    // 处理文本内容
    if (delta?.content) {
      // 首次文本，发送 content_block_start
      if (this.contentIndex === 0) {
        events.push(this.generateContentBlockStart('text', 0));
      }

      events.push({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: delta.content }
      });
    }

    // 处理 tool calls
    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const idx = toolCall.index ?? 0;

        // 新的 tool call
        if (!this.currentToolCalls.has(idx)) {
          this.currentToolCalls.set(idx, {
            id: toolCall.id || `toolu_${Date.now()}_${idx}`,
            name: toolCall.function?.name || '',
            arguments: ''
          });

          // 计算 content block index（文本块 + tool 块）
          const blockIndex = 1 + idx;
          events.push({
            type: 'content_block_start',
            index: blockIndex,
            content_block: {
              type: 'tool_use',
              id: toolCall.id || `toolu_${Date.now()}_${idx}`,
              name: toolCall.function?.name || '',
              input: {}
            }
          });
        }

        // 更新 tool call
        const current = this.currentToolCalls.get(idx);
        if (toolCall.function?.arguments) {
          current.arguments += toolCall.function.arguments;

          events.push({
            type: 'content_block_delta',
            index: 1 + idx,
            delta: {
              type: 'input_json_delta',
              partial_json: toolCall.function.arguments
            }
          });
        }
      }
    }

    // 处理 usage
    if (chunk.usage) {
      this.inputTokens = chunk.usage.prompt_tokens || 0;
      this.outputTokens = chunk.usage.completion_tokens || 0;
    }

    // 处理结束
    if (finishReason) {
      // 发送所有 content_block_stop
      const totalBlocks = 1 + this.currentToolCalls.size;
      for (let i = 0; i < totalBlocks; i++) {
        events.push({
          type: 'content_block_stop',
          index: i
        });
      }

      // 发送 message_delta
      const stopReason = this.mapStopReason(finishReason);
      events.push({
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: this.outputTokens }
      });

      // 发送 message_stop
      events.push({
        type: 'message_stop'
      });
    }

    return events;
  }

  /**
   * 映射 stop 原因
   */
  mapStopReason(finishReason) {
    if (this.currentToolCalls.size > 0) {
      return 'tool_use';
    }
    switch (finishReason) {
      case 'stop': return 'end_turn';
      case 'tool_calls': return 'tool_use';
      case 'length': return 'max_tokens';
      default: return 'end_turn';
    }
  }
}

/**
 * 将事件格式化为 SSE 字符串
 */
export function formatSSE(event) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
