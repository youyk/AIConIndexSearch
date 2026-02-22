# 安装说明

## 前置要求

1. Node.js (v16+)
2. npm 或 yarn

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

如果遇到权限问题，可以尝试：
```bash
sudo npm install
```

或者使用yarn：
```bash
yarn install
```

### 2. 创建图标文件

插件需要图标文件，请创建以下文件（或使用占位符）：
- `icons/icon16.png` (16x16像素)
- `icons/icon48.png` (48x48像素)
- `icons/icon128.png` (128x128像素)

可以使用在线工具生成图标，或者使用简单的占位图片。

### 3. 构建项目

```bash
npm run build
```

这将生成：
- `content.js` - Content Script
- `background.js` - Background Script
- `popup.js` - Popup UI

### 4. 安装到Chrome

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录（包含manifest.json的目录）

### 5. 使用插件

1. 点击浏览器工具栏中的插件图标
2. 在设置中配置需要跟踪的AI平台域名
3. 访问配置的AI平台（如chat.openai.com）进行对话
4. 插件会自动捕获对话内容
5. 使用搜索功能查找历史对话

## 开发模式

使用watch模式自动重新构建：

```bash
npm run watch
```

修改代码后会自动重新构建，在Chrome扩展页面点击"重新加载"即可看到更改。

## 故障排除

### 构建失败

如果构建失败，检查：
1. Node.js版本是否满足要求
2. 依赖是否正确安装
3. TypeScript配置是否正确

### 插件无法加载

1. 检查manifest.json格式是否正确
2. 确保所有必需的文件都已生成
3. 查看Chrome扩展页面的错误信息

### 内容捕获不工作

1. 检查域名是否在配置列表中
2. 检查浏览器控制台是否有错误
3. 确认平台适配器是否正确识别页面
