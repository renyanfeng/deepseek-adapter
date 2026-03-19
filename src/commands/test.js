/**
 * 测试连接命令
 */

import chalk from 'chalk';

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';

export async function testConnection(apiKey) {
  console.log();
  console.log(chalk.cyan('测试 DeepSeek API 连接...'));
  console.log();

  try {
    console.log(chalk.white('  → 发送测试请求...'));

    const response = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.MODEL || 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello, respond with just "OK"' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(chalk.red('  ✗ 连接失败'));
      console.log(chalk.red(`    Status: ${response.status}`));
      console.log(chalk.red(`    Error: ${errorText}`));
      console.log();
      console.log(chalk.yellow('  可能的原因:'));
      console.log(chalk.gray('    • API Key 无效或已过期'));
      console.log(chalk.gray('    • DeepSeek 账户余额不足'));
      console.log(chalk.gray('    • 网络连接问题'));
      return false;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log(chalk.green('  ✓ 连接成功!'));
    console.log();
    console.log(chalk.white('  模型响应: ') + chalk.cyan(content));
    console.log();
    console.log(chalk.white('  Token 使用:'));
    console.log(chalk.gray(`    输入: ${data.usage?.prompt_tokens || 0}`));
    console.log(chalk.gray(`    输出: ${data.usage?.completion_tokens || 0}`));
    console.log();

    console.log(chalk.green.bold('✓ API Key 有效，可以开始使用!'));
    return true;

  } catch (error) {
    console.log(chalk.red('  ✗ 连接失败'));
    console.log(chalk.red(`    Error: ${error.message}`));
    console.log();
    console.log(chalk.yellow('  请检查:'));
    console.log(chalk.gray('    • 网络连接是否正常'));
    console.log(chalk.gray('    • API Key 是否正确'));
    return false;
  }
}
