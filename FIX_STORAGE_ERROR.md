# 修复 storage is not defined 错误

## 问题
错误信息：`Uncaught (in promise) ReferenceError: storage is not defined in popup.js:91`

## 原因
浏览器可能缓存了旧版本的代码，旧代码中引用了已删除的 `storage` 变量。

## 解决步骤

### 方法1：完全重新加载插件（推荐）

1. **打开Chrome扩展管理页面**：
   - 访问 `chrome://extensions/`

2. **完全移除插件**：
   - 找到"AI对话知识库管理"插件
   - 点击"移除"按钮（不是刷新）
   - 确认移除

3. **清除浏览器缓存**：
   - 按 `Ctrl+Shift+Delete` (Windows) 或 `Cmd+Shift+Delete` (Mac)
   - 选择"缓存的图片和文件"
   - 时间范围选择"全部时间"
   - 点击"清除数据"

4. **重新加载插件**：
   - 点击"加载已解压的扩展程序"
   - 选择项目目录：`/Users/yongkang/projects/cursor/AI assistant`

### 方法2：硬刷新（如果方法1不行）

1. **关闭所有Chrome窗口**

2. **重新打开Chrome**

3. **重新加载插件**

### 方法3：检查文件

确认以下文件是最新的：

```bash
# 检查文件修改时间
ls -lh popup.js content.js background.js

# 如果文件很旧，重新构建
npm run build
```

### 方法4：验证修复

重新加载插件后：

1. 打开插件（点击图标）
2. 按 `F12` 打开开发者工具
3. 查看Console标签页
4. 应该**没有** `storage is not defined` 错误

## 如果问题仍然存在

1. **检查popup.js文件**：
   ```bash
   grep -n "storage" popup.js | grep -v "chrome.storage" | grep -v "this.storage"
   ```
   应该没有输出（除了`storageKey`这样的属性名）

2. **检查源代码**：
   ```bash
   grep -n "storage" src/popup/index.ts | grep -v "chrome.storage" | grep -v "this.storage"
   ```
   应该没有输出

3. **重新构建**：
   ```bash
   npm run build
   ```

4. **提供错误信息**：
   - 完整的错误堆栈
   - popup.js的第91行内容
   - 浏览器版本

## 验证代码

当前代码中**不应该**有：
- `const storage = ...`
- `let storage = ...`
- `var storage = ...`
- `storage.init()`
- `storage.get()`
- `storage.save()`

**应该只有**：
- `chrome.storage.local.get()`
- `chrome.storage.local.set()`
- `this.storageKey`（在DomainConfigManager类中）
