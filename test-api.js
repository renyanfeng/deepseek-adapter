#!/usr/bin/env node

/**
 * Test script for DeepSeek Adapter
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/v1';
const API_KEY = 'your-deepseek-api-key-here'; // 需要替换为实际的 DeepSeek API Key

// 测试数据
const testRequest = {
  model: 'claude-opus-4-6[1m]',
  max_tokens: 100,
  messages: [
    {
      role: 'user',
      content: 'Hello, please introduce yourself briefly.'
    }
  ]
};

async function testAPI() {
  console.log('🧪 Testing DeepSeek Adapter...\n');

  try {
    // 1. 测试模型列表
    console.log('1. Getting models list...');
    const modelsResponse = await fetch(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    if (!modelsResponse.ok) {
      throw new Error(`Models request failed: ${modelsResponse.status}`);
    }

    const modelsData = await modelsResponse.json();
    console.log(`✅ Found ${modelsData.data.length} models`);

    // 2. 测试聊天 API
    console.log('\n2. Testing chat completion...');
    const chatResponse = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(testRequest)
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new Error(`Chat request failed: ${chatResponse.status} - ${errorText}`);
    }

    const chatData = await chatResponse.json();
    console.log('✅ Chat completion successful!');
    console.log(`📝 Response model: ${chatData.model}`);
    console.log(`📝 Response tokens: ${chatData.usage.input_tokens} (input), ${chatData.usage.output_tokens} (output)`);
    console.log(`📝 Response preview: ${chatData.content[0].text.substring(0, 50)}...`);

    // 3. 测试流式响应
    console.log('\n3. Testing streaming response...');
    const streamRequest = {
      ...testRequest,
      stream: true
    };

    const streamResponse = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(streamRequest)
    });

    if (!streamResponse.ok) {
      throw new Error(`Stream request failed: ${streamResponse.status}`);
    }

    console.log('✅ Streaming response initiated successfully');
    console.log('📝 Stream status:', streamResponse.status, streamResponse.statusText);

    // 检查响应头
    const contentType = streamResponse.headers.get('content-type');
    console.log('📝 Content-Type:', contentType);

    // 读取一些流数据
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let receivedChunks = 0;
    let timeout = setTimeout(() => {
      reader.cancel();
      console.log('\n⏰ Stream reading timeout (this is normal for test)');
    }, 5000);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (chunk.includes('data:')) {
          receivedChunks++;
          if (receivedChunks <= 3) {
            console.log(`📦 Received chunk ${receivedChunks}: ${chunk.trim()}`);
          }
        }
      }
      clearTimeout(timeout);
      console.log(`📝 Total chunks received: ${receivedChunks}`);
    } catch (error) {
      clearTimeout(timeout);
      if (error.name !== 'AbortError') {
        console.log('Stream reading error:', error.message);
      }
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// 运行测试
testAPI();