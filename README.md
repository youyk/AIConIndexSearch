# AI对话知识库管理插件

一个Chrome浏览器插件，用于自动捕获、存储和管理AI对话内容，提供强大的全文搜索功能。

## 功能特性

- ✅ 自动捕获AI对话内容（支持ChatGPT、Gemini等）
- ✅ 全文搜索功能
- ✅ 标签和分类管理
- ✅ 收藏和笔记功能
- ✅ 多格式导出（JSON、Markdown、HTML、CSV）
- ✅ 域名配置管理

## 开发

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 开发模式（监听文件变化）

```bash
npm run watch
```

## 安装到Chrome

1. 构建项目：`npm run build`
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录

## 使用说明

1. 在设置中配置需要跟踪的AI平台域名
2. 访问配置的AI平台进行对话
3. 插件会自动捕获对话内容
4. 点击插件图标打开搜索界面
5. 使用搜索功能查找历史对话
6. 可以添加标签、笔记、收藏等

## 技术栈

- TypeScript
- Chrome Extension Manifest V3
- IndexedDB
- 原生JavaScript（无框架依赖）
