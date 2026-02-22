#!/bin/bash

# 构建脚本
echo "Building Chrome Extension..."

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# 构建
echo "Building..."
npm run build

# 检查构建结果
if [ -f "content.js" ] && [ -f "background.js" ] && [ -f "popup.js" ]; then
    echo "Build successful!"
    echo "Files generated:"
    echo "  - content.js"
    echo "  - background.js"
    echo "  - popup.js"
    echo ""
    echo "Next steps:"
    echo "1. Create icon files in icons/ directory (icon16.png, icon48.png, icon128.png)"
    echo "2. Open Chrome and go to chrome://extensions/"
    echo "3. Enable 'Developer mode'"
    echo "4. Click 'Load unpacked' and select this directory"
else
    echo "Build failed! Please check the errors above."
    exit 1
fi
