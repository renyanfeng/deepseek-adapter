# DeepSeek Adapter 快速开始

## 🚀 三种简单配置方式

### 方式一：命令行参数（最简单）
```bash
npx deepseek-adapter start -k your_api_key
```

### 方式二：.env 文件（推荐）
```bash
# 在项目目录创建 .env 文件
echo "DEEPSEEK_API_KEY=your_api_key" > .env

# 启动
npx deepseek-adapter start
```

### 方式三：自动配置
```bash
# 一键配置 Claude Code
npx deepseek-adapter install

# 启动
npx deepseek-adapter start -k your_api_key
```

## ⚙️ Claude Code 配置

编辑项目目录下的 `.claude/settings.json`：
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "deepseek-key",
    "ANTHROPIC_BASE_URL": "http://localhost:3000/v1"
  }
}
```

## 🎯 使用

启动后就可以在 Claude Code 中使用任何 Claude 模型了：
```bash
claude
```

然后在 Claude Code 中使用：
- `/model` - 查看当前模型
- 直接对话 - 自动使用映射的 DeepSeek 模型

## ✅ 特点

- ✅ 项目级别配置，不影响其他项目
- ✅ 支持所有 Claude 模型名称
- ✅ 自动映射到 DeepSeek 模型
- ✅ 无需全局配置