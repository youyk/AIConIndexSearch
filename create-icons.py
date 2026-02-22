#!/usr/bin/env python3
"""
创建插件图标 - AI对话知识库
需要PIL库: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import math
except ImportError:
    print("需要安装Pillow库: pip install Pillow")
    exit(1)

def create_gradient_background(size, color1, color2):
    """创建渐变背景"""
    img = Image.new('RGB', (size, size), color1)
    draw = ImageDraw.Draw(img)
    
    # 创建径向渐变效果
    center = size // 2
    for i in range(size):
        for j in range(size):
            distance = math.sqrt((i - center) ** 2 + (j - center) ** 2)
            max_distance = math.sqrt(2 * (size / 2) ** 2)
            ratio = min(distance / max_distance, 1.0)
            
            r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
            g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
            b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
            
            img.putpixel((i, j), (r, g, b))
    
    return img

def hex_to_rgb(hex_color):
    """将十六进制颜色转换为RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_icon(size, filename):
    # 主题色
    primary_color = hex_to_rgb('#4a90e2')  # 蓝色
    light_blue = hex_to_rgb('#6ba3f0')     # 浅蓝色
    white = (255, 255, 255)
    dark_blue = hex_to_rgb('#2d5aa0')      # 深蓝色
    
    # 创建渐变背景
    img = create_gradient_background(size, primary_color, dark_blue)
    draw = ImageDraw.Draw(img)
    
    center = size // 2
    scale = size / 128  # 基于128px的设计缩放
    
    if size >= 48:
        # 大图标：绘制对话气泡 + 数据库符号
        
        # 1. 绘制对话气泡（左侧）
        bubble_size = int(28 * scale)
        bubble_x = center - int(18 * scale)
        bubble_y = center - int(8 * scale)
        
        # 气泡主体
        bubble_rect = [
            bubble_x - bubble_size // 2,
            bubble_y - bubble_size // 2,
            bubble_x + bubble_size // 2,
            bubble_y + bubble_size // 2
        ]
        draw.ellipse(bubble_rect, fill=white, outline=white)
        
        # 气泡小尾巴
        tail_points = [
            (bubble_x - int(8 * scale), bubble_y + int(10 * scale)),
            (bubble_x - int(12 * scale), bubble_y + int(18 * scale)),
            (bubble_x - int(4 * scale), bubble_y + int(14 * scale))
        ]
        draw.polygon(tail_points, fill=white)
        
        # 2. 绘制数据库/知识库符号（右侧，三个堆叠的矩形）
        db_x = center + int(18 * scale)
        db_y = center
        
        db_width = int(20 * scale)
        db_height = int(6 * scale)
        db_spacing = int(4 * scale)
        
        for i in range(3):
            db_rect = [
                db_x - db_width // 2,
                db_y - db_height // 2 - int(8 * scale) + i * (db_height + db_spacing),
                db_x + db_width // 2,
                db_y - db_height // 2 - int(8 * scale) + i * (db_height + db_spacing) + db_height
            ]
            # 绘制矩形，带圆角效果
            draw.rectangle(db_rect, fill=white, outline=white)
            
            # 在矩形中间画一条线（表示数据）
            if i < 2:
                line_y = db_rect[1] + db_height // 2
                draw.line(
                    [db_rect[0] + int(4 * scale), line_y, db_rect[2] - int(4 * scale), line_y],
                    fill=primary_color,
                    width=int(2 * scale)
                )
        
        # 3. 添加连接线（可选，表示关联）
        if size >= 64:
            draw.line(
                [bubble_x + int(12 * scale), bubble_y, db_x - int(10 * scale), db_y - int(4 * scale)],
                fill=white,
                width=int(2 * scale)
            )
    
    elif size >= 16:
        # 中等图标：简化的设计
        # 只绘制对话气泡
        bubble_size = int(10 * scale)
        bubble_x = center
        bubble_y = center - int(2 * scale)
        
        bubble_rect = [
            bubble_x - bubble_size // 2,
            bubble_y - bubble_size // 2,
            bubble_x + bubble_size // 2,
            bubble_y + bubble_size // 2
        ]
        draw.ellipse(bubble_rect, fill=white, outline=white)
        
        # 简化的数据库符号（两个小矩形）
        db_x = center
        db_y = center + int(6 * scale)
        
        for i in range(2):
            db_rect = [
                db_x - int(6 * scale),
                db_y - int(2 * scale) + i * int(3 * scale),
                db_x + int(6 * scale),
                db_y - int(2 * scale) + i * int(3 * scale) + int(2 * scale)
            ]
            draw.rectangle(db_rect, fill=white, outline=white)
    else:
        # 小图标：最简单的设计
        # 只绘制一个对话气泡
        bubble_size = int(8 * scale)
        bubble_rect = [
            center - bubble_size // 2,
            center - bubble_size // 2,
            center + bubble_size // 2,
            center + bubble_size // 2
        ]
        draw.ellipse(bubble_rect, fill=white, outline=white)
    
    # 添加圆角效果（可选）
    if size >= 48:
        # 创建圆角遮罩
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        corner_radius = int(8 * scale)
        mask_draw.rounded_rectangle(
            [0, 0, size, size],
            radius=corner_radius,
            fill=255
        )
        
        # 应用圆角（如果PIL版本支持）
        try:
            img.putalpha(mask)
            # 转换回RGB（移除alpha通道用于保存为PNG）
            img = img.convert('RGB')
        except:
            pass
    
    # 保存
    img.save(filename, 'PNG', optimize=True)
    print(f"Created {filename} ({size}x{size})")

if __name__ == "__main__":
    import os
    # 确保icons目录存在
    os.makedirs("icons", exist_ok=True)
    
    sizes = [16, 48, 128]
    for size in sizes:
        create_icon(size, f"icons/icon{size}.png")
    print("All icons created successfully!")
    print("\n图标设计说明:")
    print("- 蓝色渐变背景（主题色 #4a90e2）")
    print("- 白色对话气泡（代表AI对话）")
    print("- 白色数据库符号（代表知识库存储）")
    print("- 现代简洁的设计风格")