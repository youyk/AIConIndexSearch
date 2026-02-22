# 图标文件

插件需要以下图标文件：

- `icon16.png` - 16x16像素
- `icon48.png` - 48x48像素  
- `icon128.png` - 128x128像素

## 创建图标

你可以使用以下方法创建图标：

1. **在线工具**：
   - https://www.favicon-generator.org/
   - https://realfavicongenerator.net/

2. **使用ImageMagick创建简单占位符**：
   ```bash
   convert -size 16x16 xc:#4a90e2 icon16.png
   convert -size 48x48 xc:#4a90e2 icon48.png
   convert -size 128x128 xc:#4a90e2 icon128.png
   ```

3. **使用Python PIL创建**：
   ```python
   from PIL import Image, ImageDraw
   
   sizes = [16, 48, 128]
   for size in sizes:
       img = Image.new('RGB', (size, size), color='#4a90e2')
       img.save(f'icon{size}.png')
   ```

4. **临时方案**：可以使用任何16x16, 48x48, 128x128的PNG图片作为占位符

## 图标设计建议

- 使用蓝色主题（#4a90e2）与插件UI保持一致
- 可以包含"AI"或"KB"字样
- 简洁明了，在小尺寸下也能清晰识别
