#!/usr/bin/env python3
"""
创建插件图标 - AI对话知识库
使用新的紫色渐变主题，设计元素：对话气泡 + 知识库符号
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

def create_icon(size, filename, enabled=True):
    # 使用浅色背景，适配深色工具栏
    # 背景色：浅灰白色渐变
    bg_color1 = hex_to_rgb('#f8f9fa')  # 浅灰白
    bg_color2 = hex_to_rgb('#e9ecef')   # 稍深的浅灰
    
    # 根据启用状态选择颜色
    if enabled:
        # 启用状态 - 紫色（用于符号）
        primary_color = hex_to_rgb('#667eea')  # 主紫色
        secondary_color = hex_to_rgb('#764ba2')  # 深紫色
        purple_dark = hex_to_rgb('#5a67d8')  # 深紫色用于轮廓
    else:
        # 禁用状态 - 灰色（用于符号）
        primary_color = hex_to_rgb('#9ca3af')  # 灰色
        secondary_color = hex_to_rgb('#6b7280')  # 深灰色
        purple_dark = hex_to_rgb('#4b5563')  # 更深灰色用于轮廓
    
    # 创建浅色渐变背景
    img = create_gradient_background(size, bg_color1, bg_color2)
    draw = ImageDraw.Draw(img)
    
    center = size // 2
    scale = size / 128  # 基于128px的设计缩放
    
    if size >= 48:
        # 大图标：绘制对话气泡 + 知识库符号（更大更明显）
        
        # 1. 绘制对话气泡（左侧，更大）
        bubble_size = int(50 * scale)  # 从32增加到50
        bubble_x = center - int(25 * scale)  # 从20增加到25
        bubble_y = center - int(2 * scale)
        
        # 气泡主体（圆形，带紫色边框）
        bubble_rect = [
            bubble_x - bubble_size // 2,
            bubble_y - bubble_size // 2,
            bubble_x + bubble_size // 2,
            bubble_y + bubble_size // 2
        ]
        # 先画边框
        draw.ellipse(bubble_rect, fill=primary_color, outline=purple_dark, width=int(2 * scale))
        
        # 气泡内部白色区域
        inner_bubble_rect = [
            bubble_x - bubble_size // 2 + int(3 * scale),
            bubble_y - bubble_size // 2 + int(3 * scale),
            bubble_x + bubble_size // 2 - int(3 * scale),
            bubble_y + bubble_size // 2 - int(3 * scale)
        ]
        draw.ellipse(inner_bubble_rect, fill=(255, 255, 255))
        
        # 气泡内部的大圆点（表示对话内容，更大更明显）
        dot_size = int(6 * scale)  # 从3增加到6
        dots = [
            (bubble_x - int(10 * scale), bubble_y - int(6 * scale)),
            (bubble_x, bubble_y),
            (bubble_x + int(10 * scale), bubble_y + int(6 * scale))
        ]
        for dot_x, dot_y in dots:
            dot_rect = [
                dot_x - dot_size,
                dot_y - dot_size,
                dot_x + dot_size,
                dot_y + dot_size
            ]
            draw.ellipse(dot_rect, fill=primary_color)
        
        # 气泡小尾巴（指向知识库，更大）
        tail_size = int(8 * scale)
        tail_points = [
            (bubble_x + int(18 * scale), bubble_y + int(12 * scale)),
            (bubble_x + int(28 * scale), bubble_y + int(18 * scale)),
            (bubble_x + int(22 * scale), bubble_y + int(24 * scale))
        ]
        draw.polygon(tail_points, fill=primary_color, outline=purple_dark, width=int(1.5 * scale))
        
        # 2. 绘制知识库符号（右侧，书本/文档堆叠，更大）
        book_x = center + int(25 * scale)  # 从20增加到25
        book_y = center + int(8 * scale)
        
        # 绘制三本书/文档（堆叠效果，更大）
        book_width = int(28 * scale)  # 从18增加到28
        book_height = int(36 * scale)  # 从24增加到36
        book_spacing = int(3 * scale)
        
        for i in range(3):
            offset_x = i * book_spacing
            offset_y = -i * int(3 * scale)
            
            # 书本主体（带紫色边框）
            book_rect = [
                book_x - book_width // 2 + offset_x,
                book_y - book_height // 2 + offset_y,
                book_x + book_width // 2 + offset_x,
                book_y + book_height // 2 + offset_y
            ]
            
            # 绘制书本（带边框）
            draw.rectangle(book_rect, fill=primary_color, outline=purple_dark, width=int(2 * scale))
            
            # 书本中间的线（表示页面，更粗）
            if i < 2:
                line_y = book_rect[1] + book_height // 2
                draw.line(
                    [book_rect[0] + int(5 * scale), line_y, book_rect[2] - int(5 * scale), line_y],
                    fill=(255, 255, 255),
                    width=int(2.5 * scale)
                )
        
        # 3. 添加连接线（表示对话存储到知识库，更粗）
        if size >= 64:
            # 从气泡到书本的连接线
            draw.line(
                [bubble_x + int(25 * scale), bubble_y + int(15 * scale), 
                 book_x - int(14 * scale), book_y - int(12 * scale)],
                fill=primary_color,
                width=int(3 * scale)
            )
    
    elif size >= 16:
        # 中等图标：简化的设计（更大更明显）
        # 对话气泡 + 简化书本
        bubble_size = int(18 * scale)  # 从12增加到18
        bubble_x = center - int(8 * scale)
        bubble_y = center
        
        # 对话气泡（带紫色边框）
        bubble_rect = [
            bubble_x - bubble_size // 2,
            bubble_y - bubble_size // 2,
            bubble_x + bubble_size // 2,
            bubble_y + bubble_size // 2
        ]
        draw.ellipse(bubble_rect, fill=primary_color, outline=purple_dark, width=int(1.5 * scale))
        
        # 气泡内的白色区域
        inner_rect = [
            bubble_x - bubble_size // 2 + int(2 * scale),
            bubble_y - bubble_size // 2 + int(2 * scale),
            bubble_x + bubble_size // 2 - int(2 * scale),
            bubble_y + bubble_size // 2 - int(2 * scale)
        ]
        draw.ellipse(inner_rect, fill=(255, 255, 255))
        
        # 气泡内的大点
        dot_size = int(3 * scale)  # 从1.5增加到3
        draw.ellipse([
            bubble_x - dot_size,
            bubble_y - dot_size,
            bubble_x + dot_size,
            bubble_y + dot_size
        ], fill=primary_color)
        
        # 简化的书本（两个堆叠的矩形，更大）
        book_x = center + int(8 * scale)
        book_y = center + int(2 * scale)
        
        for i in range(2):
            book_rect = [
                book_x - int(7 * scale) + i * int(2 * scale),  # 从5增加到7
                book_y - int(6 * scale) - i * int(1.5 * scale),  # 从4增加到6
                book_x + int(7 * scale) + i * int(2 * scale),
                book_y + int(6 * scale) - i * int(1.5 * scale)
            ]
            draw.rectangle(book_rect, fill=primary_color, outline=purple_dark, width=int(1.5 * scale))
    else:
        # 小图标：最简单的设计（更大更明显）
        # 只绘制一个对话气泡
        bubble_size = int(14 * scale)  # 从10增加到14
        bubble_rect = [
            center - bubble_size // 2,
            center - bubble_size // 2,
            center + bubble_size // 2,
            center + bubble_size // 2
        ]
        # 紫色气泡，带边框
        draw.ellipse(bubble_rect, fill=primary_color, outline=purple_dark, width=int(1.5 * scale))
        
        # 内部白色区域
        inner_rect = [
            center - bubble_size // 2 + int(2 * scale),
            center - bubble_size // 2 + int(2 * scale),
            center + bubble_size // 2 - int(2 * scale),
            center + bubble_size // 2 - int(2 * scale)
        ]
        draw.ellipse(inner_rect, fill=(255, 255, 255))
        
        # 气泡内的大点
        dot_size = int(3 * scale)  # 从1.5增加到3
        draw.ellipse([
            center - dot_size,
            center - dot_size,
            center + dot_size,
            center + dot_size
        ], fill=primary_color)
    
    # 添加圆角效果
    if size >= 48:
        # 创建圆角遮罩
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        corner_radius = int(12 * scale)
        
        # 绘制圆角矩形
        mask_draw.rounded_rectangle(
            [0, 0, size, size],
            radius=corner_radius,
            fill=255
        )
        
        # 应用圆角（如果PIL版本支持）
        try:
            # 创建带alpha通道的图像
            img_rgba = img.convert('RGBA')
            img_rgba.putalpha(mask)
            # 转换回RGB用于保存
            img = img_rgba.convert('RGB')
        except:
            pass
    
    # 保存
    img.save(filename, 'PNG', optimize=True)
    print(f"✓ Created {filename} ({size}x{size})")

if __name__ == "__main__":
    import os
    # 确保icons目录存在
    os.makedirs("icons", exist_ok=True)
    
    sizes = [16, 48, 128]
    print("正在创建图标...")
    print("=" * 50)
    
    # 创建启用状态的图标（默认）
    for size in sizes:
        create_icon(size, f"icons/icon{size}.png", enabled=True)
    
    # 创建禁用状态的图标
    for size in sizes:
        create_icon(size, f"icons/icon{size}_disabled.png", enabled=False)
    
    print("=" * 50)
    print("✓ 所有图标创建成功！")
    print("\n图标设计说明:")
    print("- 浅色背景（#f8f9fa → #e9ecef），适配深色工具栏")
    print("- 启用状态：紫色对话气泡和书本（#667eea）")
    print("- 禁用状态：灰色对话气泡和书本（#9ca3af）")
    print("- 符号尺寸大幅增加，高辨识度")
    print("- 所有尺寸下都能清晰识别")
    print("\n图标文件:")
    print("- icon16.png / icon16_disabled.png")
    print("- icon48.png / icon48_disabled.png")
    print("- icon128.png / icon128_disabled.png")
