# deepseek-adapter

> 使用 DeepSeek 模型与 Claude Code - Anthropic 兼容 API 适配器

[![npm version](https://img.shields.io/npm/v/deepseek-adapter.svg)](https://www.npmjs.com/package/deepseek-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 功能

- ✅ 将 DeepSeek API 转换为 Anthropic 兼容格式
- ✅ 支持 Claude Code 完整功能
- ✅ 支持流式响应
- ✅ 支持 Tool Calling
- ✅ 支持多模态（图片）

## 📦 安装

```bash
npm install -g deepseek-adapter
```

或使用 npx:

```bash
npx deepseek-adapter start
```

## 🚀 快速开始

### 1. 获取 DeepSeek API Key

访问 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并创建 API Key。

### 2. 自动配置 Claude Code（推荐）

```bash
# 一键安装配置
npx deepseek-adapter install

# 设置 API Key
echo "DEEPSEEK_API_KEY=your_api_key" > .env

# 启动代理
npx deepseek-adapter start
```

### 3. 启动代理服务

**方式一: 使用 .env 配置文件（推荐）**

在项目目录或用户目录创建 `.env` 文件：

```bash
# 创建配置文件
cp .env.example .env

# 编辑 .env 文件，填入你的 API Key
# DEEPSEEK_API_KEY=your_api_key_here

# 启动服务
npx deepseek-adapter start
```

配置文件搜索路径（按优先级）：
1. 当前工作目录的 `.env`
2. 项目目录的 `.env`

**方式二: 使用 .env 配置文件**

在项目目录创建 `.env` 文件：

```bash
echo "DEEPSEEK_API_KEY=your_api_key" > .env
npx deepseek-adapter start
```

**方式三: 使用命令行参数**

```bash
npx deepseek-adapter start -k your_api_key
```

**方式四: 指定配置文件路径**

```bash
npx deepseek-adapter start -c /path/to/.env
```

### 4. 配置 Claude Code

编辑 `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "deepseek-key",
    "ANTHROPIC_BASE_URL": "http://localhost:3000/v1"
  }
}
```

### 5. 启动 Claude Code

```bash
claude
```

## 📖 命令

```bash
# 启动代理服务
npx deepseek-adapter start

# 自动配置 Claude Code（推荐）
npx deepseek-adapter install

# 移除配置
npx deepseek-adapter uninstall

# 显示配置说明
npx deepseek-adapter config

# 测试 API 连接
npx deepseek-adapter test
```

### 启动选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-k, --api-key <key>` | DeepSeek API Key | `DEEPSEEK_API_KEY` 环境变量 |
| `-m, --model <model>` | 使用的模型 | `deepseek-reasoner` |
| `-p, --port <port>` | 服务端口 | `3000` |
| `-h, --host <host>` | 服务地址 | `localhost` |

## 🤖 支持的模型

### DeepSeek 原生模型

| 模型 | 说明 |
|------|------|
| `deepseek-reasoner` | 推理增强模型（默认） |
| `deepseek-chat` | 主力对话模型 |

### Claude 模型映射

**所有 Claude 模型统一映射到 DeepSeek Reasoner**

- 无需担心模型名称不匹配
- 自动使用 DeepSeek 最强的推理模型
- 支持任意 Claude 模型名称（如 `claude-opus-4-6[1m]`、`claude-sonnet-4-6` 等）

## 🔧 高级用法

### 作为库使用

```javascript
import { startServer } from 'deepseek-adapter';

await startServer({
  apiKey: 'your_api_key',
  port: 3000,
  host: 'localhost',
  model: 'deepseek-reasoner'
});
```

### 自定义转换

```javascript
import { claudeToOpenAI, openAIToClaude } from 'deepseek-adapter';

// Claude 请求 → OpenAI 格式
const openaiReq = claudeToOpenAI(claudeRequest);

// OpenAI 响应 → Claude 格式
const claudeRes = openAIToClaude(openaiResponse);
```

## ⚠️ 已知限制

1. **Tool Calling 差异**: DeepSeek 的 Function Calling 格式与 Claude 略有不同，大部分场景可正常工作
2. **上下文长度**: DeepSeek 64K vs Claude 200K，超长对话可能受限
3. **响应速度**: 可能比 Claude 原生 API 稍慢

## 🛠️ 故障排除

### API Key 无效

```
Error: DeepSeek API error: 401
```

检查:
- API Key 是否正确
- 是否已开通 DeepSeek 服务
- API Key 是否有余额

### 端口被占用

```
Error: listen EADDRINUSE
```

使用其他端口:
```bash
npx deepseek-adapter start -p 3001
```

## 📝 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 相关项目

- [qwen-adapter](https://github.com/renyanfeng/qwen-adapter) - 通义千问适配器
