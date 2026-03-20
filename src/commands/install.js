/**
 * 安装/配置命令 - 自动配置 Claude Code
 */

import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.local.json');

export async function install(options) {
  console.log();
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('           配置 Claude Code 使用 DeepSeek Adapter'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log();

  const port = options.port || '3000';
  const host = options.host || 'localhost';
  const baseUrl = `http://${host}:${port}`;

  // 读取现有配置
  let settings = {};
  if (existsSync(SETTINGS_FILE)) {
    try {
      const content = readFileSync(SETTINGS_FILE, 'utf-8');
      settings = JSON.parse(content);
      console.log(chalk.gray('  找到现有配置文件'));
    } catch (e) {
      console.log(chalk.yellow('  现有配置文件格式错误，将创建新配置'));
    }
  } else {
    // 确保目录存在
    if (!existsSync(CLAUDE_DIR)) {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      console.log(chalk.gray('  创建配置目录: ~/.claude'));
    }
  }

  // 合并配置
  const newEnv = {
    ...settings.env,
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: 'deepseek-adapter',
  };

  const newSettings = {
    ...settings,
    env: newEnv,
  };

  // 写入配置
  writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));

  console.log(chalk.green('  ✓ 配置已更新'));
  console.log();
  console.log(chalk.yellow.bold('  配置内容:'));
  console.log(chalk.white('  文件: ') + chalk.cyan(SETTINGS_FILE));
  console.log();
  console.log(chalk.cyan('  {'));
  console.log(chalk.cyan('    "env": {'));
  console.log(chalk.cyan('      "ANTHROPIC_BASE_URL": "') + chalk.green(baseUrl) + chalk.cyan('",'));
  console.log(chalk.cyan('      "ANTHROPIC_AUTH_TOKEN": "deepseek-adapter"'));
  console.log(chalk.cyan('    }'));
  console.log(chalk.cyan('  }'));
  console.log();
  console.log(chalk.yellow.bold('  下一步:'));
  console.log(chalk.white('  1. 启动 DeepSeek Adapter:'));
  console.log(chalk.green('     npx deepseek-adapter start'));
  console.log();
  console.log(chalk.white('  2. 重启 Claude Code'));
  console.log();
  console.log(chalk.white('  3. 验证配置:'));
  console.log(chalk.green('     /model'));
  console.log();
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log();
}

export async function uninstall() {
  console.log();
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('           移除 DeepSeek Adapter 配置'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
  console.log();

  if (!existsSync(SETTINGS_FILE)) {
    console.log(chalk.yellow('  未找到配置文件'));
    return;
  }

  const content = readFileSync(SETTINGS_FILE, 'utf-8');
  const settings = JSON.parse(content);

  // 移除 DeepSeek Adapter 相关配置
  const newEnv = { ...settings.env };
  delete newEnv.ANTHROPIC_BASE_URL;
  delete newEnv.ANTHROPIC_AUTH_TOKEN;

  const newSettings = {
    ...settings,
    env: Object.keys(newEnv).length > 0 ? newEnv : undefined,
  };

  if (Object.keys(newEnv).length === 0) {
    delete newSettings.env;
  }

  writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));

  console.log(chalk.green('  ✓ 配置已移除'));
  console.log(chalk.white('  文件: ') + chalk.cyan(SETTINGS_FILE));
  console.log();
  console.log(chalk.yellow('  重启 Claude Code 使更改生效'));
  console.log();
}
