# 快速开始指南

## 步骤1: 安装依赖

```bash
npm install
```

如果遇到权限问题，可以尝试：
- 使用 `sudo npm install`（不推荐）
- 使用 `yarn install`
- 或者手动安装依赖包

## 步骤2: 创建图标

### 方法1: 使用Python脚本（推荐）

```bash
pip install Pillow
python3 create-icons.py
```

### 方法2: 手动创建

创建以下文件在 `icons/` 目录：
- `icon16.png` (16x16像素)
- `icon48.png` (48x48像素)
- `icon128.png` (128x128像素)

可以使用任何图片编辑工具创建，或使用在线图标生成器。

### 方法3: 使用占位图片

可以暂时使用任何PNG图片重命名后放在icons目录。

## 步骤3: 构建项目

```bash
npm run build
```

或者使用构建脚本：
```bash
./build.sh
```

构建成功后，会在项目根目录生成：
- `content.js`
- `background.js`
- `popup.js`

## 步骤4: 安装到Chrome

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"开关
4. 点击"加载已解压的扩展程序"按钮
5. 选择项目根目录（包含manifest.json的目录）
6. 插件应该出现在扩展列表中

## 步骤5: 配置和使用

1. **配置域名**：
   - 点击浏览器工具栏中的插件图标
   - 点击设置按钮（⚙️）
   - 在"域名配置"中添加要跟踪的AI平台域名
   - 默认已包含：gemini.google.com, chat.openai.com等

2. **开始使用**：
   - 访问配置的AI平台（如 chat.openai.com）
   - 与AI进行对话
   - 插件会自动捕获对话内容（后台进行）

3. **搜索对话**：
   - 点击插件图标打开搜索界面
   - 输入关键词搜索
   - 使用筛选器缩小范围
   - 点击结果查看详情

4. **管理对话**：
   - 在详情页面可以添加标签、笔记
   - 可以收藏重要对话
   - 可以删除不需要的对话

5. **导出数据**：
   - 在设置页面点击"导出全部数据"
   - 或选中对话后导出
   - 支持JSON、Markdown、HTML、CSV格式

## 故障排除

### 插件无法加载

- 检查manifest.json格式是否正确
- 确保所有必需文件都已生成（content.js, background.js, popup.js）
- 查看Chrome扩展页面的错误信息

### 内容捕获不工作

- 检查域名是否在配置列表中且已启用
- 打开浏览器开发者工具（F12）查看控制台错误
- 确认当前页面是支持的AI平台

### 搜索不工作

- 检查是否有对话被捕获
- 查看Background Script的控制台日志
- 尝试重新加载插件

### 构建失败

- 检查Node.js版本（需要v16+）
- 确保所有依赖已正确安装
- 查看构建错误信息

## 开发模式

使用watch模式自动重新构建：

```bash
npm run watch
```

修改代码后会自动重新构建，在Chrome扩展页面点击"重新加载"即可看到更改。

## 支持的平台

目前支持：
- ChatGPT (chat.openai.com)
- Google Gemini (gemini.google.com)

更多平台支持正在开发中。
