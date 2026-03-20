/**
 * ESLint 配置 - deepseek-adapter
 *
 * 公共库代码规范配置
 */

module.exports = {
  // 使用 ESM 模块系统
  type: 'module',

  // 运行环境
  env: {
    es2021: true,
    node: true,
  },

  // 解析选项
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },

  // 继承的规则集
  extends: 'eslint:recommended',

  // 自定义规则
  rules: {
    // 允许使用下划线开头的未使用变量（用于表示有意忽略的参数）
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    // 允许在 switch 中使用常量条件
    'no-constant-condition': 'off',

    // 要求使用 const 或 let（禁用 var）
    'no-var': 'error',

    // 强制使用单引号
    quotes: ['error', 'single', { avoidEscape: true }],

    // 强制使用分号
    semi: ['error', 'always'],

    // 要求函数参数使用默认值而不是在函数体内检查
    'no-else-return': 'error',
  },

  // 忽略的文件和目录
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '*.d.ts',
  ],
};
