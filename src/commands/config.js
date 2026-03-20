/**
 * 配置说明命令
 */

import chalk from 'chalk';

export function showConfig() {
  console.log();
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('           DeepSeek Adapter for Claude Code - 配置说明'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log();

  console.log(chalk.yellow.bold('1. 获取 DeepSeek API Key'));
  console.log(chalk.white('   访问: ') + chalk.cyan('https://platform.deepseek.com/'));
  console.log(chalk.gray('   → 注册/登录 → API Keys → 创建 API Key'));
  console.log();

  console.log(chalk.yellow.bold('2. 启动代理服务'));
  console.log(chalk.white('   方式一: 命令行参数'));
  console.log(chalk.green('   npx deepseek-adapter start -k YOUR_API_KEY'));
  console.log();
  console.log(chalk.white('   方式二: .env 文件'));
  console.log(chalk.gray('   在项目根目录创建 .env 文件:'));
  console.log(chalk.green('   DEEPSEEK_API_KEY=YOUR_API_KEY'));
  console.log(chalk.green('   npx deepseek-adapter start'));
  console.log();
  console.log(chalk.white('   方式三: .env 文件'));
  console.log(chalk.gray('   在项目根目录创建 .env 文件:'));
  console.log(chalk.green('   DEEPSEEK_API_KEY=YOUR_API_KEY'));
  console.log();

  console.log(chalk.yellow.bold('3. 配置 Claude Code'));
  console.log(chalk.white('   编辑 ~/.claude/settings.json:'));
  console.log();
  console.log(chalk.cyan('   {'));
  console.log(chalk.cyan('     "env": {'));
  console.log(chalk.cyan('       "ANTHROPIC_AUTH_TOKEN": "deepseek-key",'));
  console.log(chalk.cyan('       "ANTHROPIC_BASE_URL": "http://localhost:3000"'));
  console.log(chalk.cyan('     }'));
  console.log(chalk.cyan('   }'));
  console.log();

  console.log(chalk.yellow.bold('4. 重启 Claude Code'));
  console.log(chalk.green('   claude'));
  console.log();

  console.log(chalk.yellow.bold('5. 验证配置'));
  console.log(chalk.white('   在 Claude Code 中运行:'));
  console.log(chalk.green('   /model'));
  console.log(chalk.gray('   应该显示 deepseek-chat 或你配置的模型'));
  console.log();

  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log();

  console.log(chalk.yellow('可用模型:'));
  console.log(chalk.white('  • deepseek-chat     ') + chalk.gray('- 主力模型，推荐'));
  console.log(chalk.white('  • deepseek-reasoner ') + chalk.gray('- 推理增强模型'));
  console.log();

  console.log(chalk.yellow('命令行选项:'));
  console.log(chalk.white('  -k, --api-key <key>   ') + chalk.gray('API Key'));
  console.log(chalk.white('  -m, --model <model>   ') + chalk.gray('模型名称 (default: deepseek-chat)'));
  console.log(chalk.white('  -p, --port <port>     ') + chalk.gray('服务端口 (default: 3000)'));
  console.log(chalk.white('  -h, --host <host>     ') + chalk.gray('服务地址 (default: localhost)'));
  console.log();
}
