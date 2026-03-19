#!/usr/bin/env node

/**
 * 基本集成测试
 */

import { strict as assert } from 'assert';
import { mapModelName } from '../src/converters/request.js';

// 测试模型映射
console.log('🧪 测试模型映射功能...\n');

const testCases = [
  { input: 'claude-opus-4-6', expected: 'deepseek-reasoner' },
  { input: 'claude-opus-4-6[1m]', expected: 'deepseek-reasoner' },
  { input: 'claude-sonnet-4-6', expected: 'deepseek-chat' },
  { input: 'claude-haiku-4-5', expected: 'deepseek-chat' },
  { input: 'claude-3-5-sonnet', expected: 'deepseek-chat' },
  { input: 'unknown-model', expected: 'deepseek-chat' }, // 默认值
];

let passed = 0;
let total = testCases.length;

for (const testCase of testCases) {
  try {
    const result = mapModelName(testCase.input);
    assert.strictEqual(result, testCase.expected, `模型映射失败: ${testCase.input} → ${result} (期望: ${testCase.expected})`);
    console.log(`✅ ${testCase.input.padEnd(20)} → ${result}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${testCase.input.padEnd(20)} → ${error.message}`);
  }
}

console.log(`\n📊 测试结果: ${passed}/${total} 通过`);

if (passed === total) {
  console.log('\n🎉 所有测试通过！');
  process.exit(0);
} else {
  console.log('\n💥 有测试失败！');
  process.exit(1);
}