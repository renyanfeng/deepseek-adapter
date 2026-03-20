#!/usr/bin/env node

/**
 * deepseek-adapter CLI
 *
 * 用法:
 *   npx deepseek-adapter start                    # 启动代理服务
 *   npx deepseek-adapter config                   # 显示配置说明
 *   npx deepseek-adapter test                     # 测试连接
 */

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { startServer } from '../src/server.js';
import { showConfig } from '../src/commands/config.js';
import { testConnection } from '../src/commands/test.js';
import { install, uninstall } from '../src/commands/install.js';

// 加载 .env 文件（从当前工作目录和项目目录）
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPaths = [
  join(process.cwd(), '.env'),           // 当前工作目录
  join(__dirname, '..', '.env'),         // 项目目录
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const program = new Command();

program
  .name('deepseek-adapter')
  .description('Use DeepSeek models with Claude Code - An Anthropic-compatible API adapter')
  .version('1.0.0');

// start 命令
program
  .command('start')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'Server port', process.env.PORT || '3000')
  .option('-k, --api-key <key>', 'DeepSeek API Key', process.env.DEEPSEEK_API_KEY)
  .option('-m, --model <model>', 'DeepSeek model to use', process.env.MODEL || 'deepseek-chat')
  .option('-h, --host <host>', 'Server host', process.env.HOST || 'localhost')
  .option('-c, --config <path>', 'Path to .env config file')
  .action(async (options) => {
    // 如果指定了配置文件，加载它
    if (options.config) {
      dotenv.config({ path: options.config });
      // 重新读取配置
      options.apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY;
      options.port = options.port !== '3000' ? options.port : (process.env.PORT || '3000');
      options.model = options.model !== 'deepseek-chat' ? options.model : (process.env.MODEL || 'deepseek-chat');
      options.host = options.host !== 'localhost' ? options.host : (process.env.HOST || 'localhost');
    }

    const apiKey = options.apiKey;

    if (!apiKey) {
      console.error(chalk.red('Error: DEEPSEEK_API_KEY is required'));
      console.error(chalk.yellow('Set it via:'));
      console.error('  - Command line: --api-key YOUR_KEY');
      console.error('  - .env file: DEEPSEEK_API_KEY=YOUR_KEY');
      console.error('  - Config file: --config /path/to/.env');
      process.exit(1);
    }

    console.log(chalk.cyan.bold('\n🚀 DeepSeek Adapter for Claude Code\n'));
    console.log(chalk.gray('━'.repeat(40)));
    console.log(chalk.white(`  Model:  `) + chalk.green(options.model));
    console.log(chalk.white(`  Port:   `) + chalk.green(options.port));
    console.log(chalk.white(`  Host:   `) + chalk.green(options.host));
    console.log(chalk.gray('━'.repeat(40)));
    console.log(chalk.yellow('\nClaude Code 配置:'));
    console.log(chalk.white('  ANTHROPIC_BASE_URL: ') + chalk.cyan(`http://${options.host}:${options.port}`));
    console.log(chalk.white('  ANTHROPIC_AUTH_TOKEN: ') + chalk.cyan('任意值（如: deepseek-key）'));
    console.log();

    await startServer({
      port: parseInt(options.port),
      host: options.host,
      apiKey,
      model: options.model
    });
  });

// config 命令
program
  .command('config')
  .description('Show configuration instructions')
  .action(() => {
    showConfig();
  });

// test 命令
program
  .command('test')
  .description('Test DeepSeek API connection')
  .option('-k, --api-key <key>', 'DeepSeek API Key')
  .action(async (options) => {
    const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: DEEPSEEK_API_KEY is required'));
      process.exit(1);
    }
    await testConnection(apiKey);
  });

// install 命令 - 自动配置 Claude Code
program
  .command('install')
  .description('Configure Claude Code to use DeepSeek Adapter')
  .option('-p, --port <port>', 'Proxy server port', '3000')
  .option('-h, --host <host>', 'Proxy server host', 'localhost')
  .action(async (options) => {
    await install(options);
  });

// uninstall 命令 - 移除配置
program
  .command('uninstall')
  .description('Remove DeepSeek Adapter configuration from Claude Code')
  .action(async () => {
    await uninstall();
  });

program.parse();
