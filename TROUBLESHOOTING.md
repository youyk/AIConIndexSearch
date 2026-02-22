# 故障排除指南

## 常见错误

### 1. `storage is not defined` 错误

**症状**：打开插件时出现 `Uncaught (in promise) ReferenceError: storage is not defined`

**原因**：浏览器缓存了旧版本的代码

**解决方法**：

1. **完全重新加载插件**：
   - 打开 `chrome://extensions/`
   - 找到"AI对话知识库管理"
   - 点击"移除"按钮
   - 然后重新"加载已解压的扩展程序"

2. **清除浏览器缓存**：
   - 按 `Ctrl+Shift+Delete` (Windows) 或 `Cmd+Shift+Delete` (Mac)
   - 选择"缓存的图片和文件"
   - 点击"清除数据"

3. **硬刷新页面**：
   - 如果是在网页中使用，按 `Ctrl+F5` (Windows) 或 `Cmd+Shift+R` (Mac)

4. **重新构建项目**：
   ```bash
   npm run build
   ```

### 2. 内容捕获不工作

**症状**：在AI平台对话后，插件中没有记录

**检查步骤**：

1. **检查域名配置**：
   - 打开插件设置
   - 确认域名在列表中且已启用

2. **检查浏览器控制台**：
   - 按 `F12` 打开开发者工具
   - 查看Console标签页
   - 查找以 `[AI KB]` 开头的日志

3. **检查Background Script**：
   - 在扩展管理页面
   - 找到插件，点击"检查视图" → "Service Worker"
   - 查看是否有错误

4. **手动测试**：
   - 在控制台输入：
   ```javascript
   // 检查插件是否加载
   console.log('[AI KB] Plugin loaded');
   ```

### 3. 搜索不工作

**症状**：搜索没有结果或报错

**解决方法**：

1. 确认有对话被捕获
2. 尝试更宽泛的搜索关键词
3. 清除所有筛选条件
4. 检查Background Script是否有错误

### 4. 导出失败

**症状**：点击导出没有反应

**解决方法**：

1. 检查浏览器下载设置
2. 查看控制台是否有错误
3. 尝试不同的导出格式

## 调试技巧

### 查看日志

1. **Content Script日志**：
   - 在AI平台页面按 `F12`
   - 查看Console标签页
   - 查找 `[AI KB]` 开头的日志

2. **Background Script日志**：
   - 在扩展管理页面
   - 点击"检查视图" → "Service Worker"
   - 查看Console标签页

3. **Popup日志**：
   - 右键点击插件图标
   - 选择"检查弹出内容"
   - 查看Console标签页

### 手动触发捕获

在AI平台页面的控制台中输入：

```javascript
// 触发一次捕获
window.dispatchEvent(new Event('DOMContentLoaded'));
```

### 检查数据

在Background Script的控制台中：

```javascript
// 获取所有对话
chrome.runtime.sendMessage({ type: 'GET_ALL_CONVERSATIONS' }, (response) => {
  console.log('Conversations:', response.conversations);
});
```

## 重新安装插件

如果问题持续存在，尝试完全重新安装：

1. 在扩展管理页面移除插件
2. 删除项目中的 `node_modules` 文件夹（如果存在）
3. 重新运行 `npm install`
4. 重新运行 `npm run build`
5. 重新加载插件

## 获取帮助

如果以上方法都无法解决问题，请提供：

1. 浏览器控制台的完整错误信息
2. Background Script的日志
3. 你使用的AI平台和URL
4. 操作步骤
