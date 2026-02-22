import { BaseAdapter } from './base';
import { Conversation } from '../../shared/types';

export class DeepSeekAdapter extends BaseAdapter {
  name = 'DeepSeek';

  detect(): boolean {
    return window.location.hostname.includes('deepseek.com');
  }

  extractConversations(): Conversation[] {
    const conversations: Conversation[] = [];
    const seenIds = new Set<string>(); // 用于去重，避免同一会话中重复提取
    
    // 策略：
    // 1. 找到右侧的 ds-scroll-area（包含对话内容）
    // 2. 提取对话标题（从左侧或当前对话区域）
    // 3. 在右侧找到所有 ds-message 元素
    // 4. 按顺序配对：奇数位置是问题，偶数位置是回答
    
    // 找到所有 ds-scroll-area
    const scrollAreas = document.querySelectorAll('.ds-scroll-area');
    
    if (scrollAreas.length < 2) {
      return conversations;
    }
    
    // 右侧的 ds-scroll-area 应该包含对话内容（通常第二个或最后一个）
    // 通过查找包含 ds-message 的 scroll-area 来确定
    let rightScrollArea: Element | null = null;
    for (const area of scrollAreas) {
      const hasMessages = area.querySelector('.ds-message');
      if (hasMessages) {
        rightScrollArea = area;
        break;
      }
    }
    
    if (!rightScrollArea) {
      return conversations;
    }
    
    // 提取对话标题
    let conversationTitle: string | undefined = undefined;
    
    // 方法1：从左侧 scroll-area 查找标题（在 ds-focus-ring 后面）
    for (const area of scrollAreas) {
      if (area === rightScrollArea) continue;
      
      // 查找所有 ds-focus-ring 元素，它们前面应该是标题
      const focusRings = area.querySelectorAll('.ds-focus-ring');
      for (const focusRing of focusRings) {
        // 查找紧跟在 ds-focus-ring 后面的元素（可能是标题）
        let nextEl = focusRing.nextElementSibling;
        let checkedCount = 0; // 限制检查的元素数量
        while (nextEl && checkedCount < 5) { // 最多检查5个后续元素
          checkedCount++;
          const classes = nextEl.className || '';
          // 检查是否包含标题的特征class（即使class名可能变化，但结构应该类似）
          // 标题通常是一个包含文本的元素，且class包含多个混淆的类名
          if (classes && classes.split(' ').length >= 2) {
            const titleText = this.extractText(nextEl).trim();
            // 过滤掉日期分类、空文本和UUID
            if (titleText && !this.isDateCategory(titleText) && titleText.length > 3) {
              // 进一步验证：标题不应该太短，且不应该只包含数字或特殊字符
              if (this.isValidTitle(titleText)) {
                conversationTitle = titleText;
                break;
              }
            }
          }
          nextEl = nextEl.nextElementSibling;
          // 限制查找范围，避免找到太远的元素
          if (nextEl && nextEl.classList.contains('ds-focus-ring')) break;
        }
        if (conversationTitle) break;
      }
      if (conversationTitle) break;
    }
    
    // 方法2：如果没找到，尝试查找包含特定class组合的元素（更通用的方法）
    if (!conversationTitle) {
      // 查找class包含多个单词的元素（标题的特征）
      const potentialTitles = document.querySelectorAll('[class*="afa34042"], [class*="e37a04e4"], [class*="e0a1edb7"]');
      for (const titleEl of potentialTitles) {
        // 检查前面是否有 ds-focus-ring
        let prev = titleEl.previousElementSibling;
        let checkedCount = 0;
        while (prev && prev !== titleEl.parentElement && checkedCount < 3) {
          checkedCount++;
          if (prev.classList.contains('ds-focus-ring')) {
            const titleText = this.extractText(titleEl).trim();
            if (titleText && !this.isDateCategory(titleText) && this.isValidTitle(titleText)) {
              conversationTitle = titleText;
              break;
            }
          }
          prev = prev.previousElementSibling;
        }
        if (conversationTitle) break;
      }
    }
    
    // 方法3：如果还没找到，尝试从页面URL或页面标题获取
    if (!conversationTitle) {
      // 尝试从页面标题获取
      const pageTitle = document.title;
      if (pageTitle && this.isValidTitle(pageTitle)) {
        conversationTitle = pageTitle;
      }
    }
    
    // 在右侧 scroll-area 中查找所有消息
    const allMessages = rightScrollArea.querySelectorAll('.ds-message');
    
    if (allMessages.length === 0) {
      return conversations;
    }
    
    // 按顺序配对问题和回答
    // 索引0,2,4...是问题，索引1,3,5...是回答
    // 问题class包含 d29f3d7d，回答class是 ds-message _63c77b1（不包含d29f3d7d）
    for (let i = 0; i < allMessages.length - 1; i += 2) {
      const questionEl = allMessages[i];
      const answerEl = allMessages[i + 1];
      
      if (!questionEl || !answerEl) continue;
      
      const questionClasses = questionEl.className || '';
      const answerClasses = answerEl.className || '';
      
      // 检查问题元素：应该包含 d29f3d7d（用户消息的特征）
      const isUserMessage = questionClasses.includes('d29f3d7d') && 
                           questionClasses.includes('ds-message') &&
                           questionClasses.includes('_63c77b1');
      
      // 检查回答元素：应该包含 _63c77b1 但不包含 d29f3d7d（AI回复的特征）
      const isAiMessage = answerClasses.includes('_63c77b1') && 
                         answerClasses.includes('ds-message') &&
                         !answerClasses.includes('d29f3d7d');
      
      if (!isUserMessage || !isAiMessage) {
        continue;
      }
      
      // 提取问题文本
      const question = this.extractText(questionEl).trim();
      if (!question || question.length < 5) {
        continue;
      }
      
      // 提取回答文本（从 ds-markdown 中提取所有段落）
      const markdownContainer = answerEl.querySelector('.ds-markdown');
      let answer = '';
      let answerHtml = '';
      
      if (markdownContainer) {
        // 提取所有段落
        const paragraphs = markdownContainer.querySelectorAll('.ds-markdown-paragraph');
        if (paragraphs.length > 0) {
          answer = Array.from(paragraphs)
            .map(p => this.extractText(p))
            .filter(t => t.trim())
            .join('\n\n')
            .trim();
          answerHtml = Array.from(paragraphs)
            .map(p => this.extractHtml(p))
            .filter(h => h.trim())
            .join('\n\n')
            .trim();
        } else {
          // 如果没有段落，直接提取整个markdown内容
          answer = this.extractText(markdownContainer).trim();
          answerHtml = this.extractHtml(markdownContainer).trim();
        }
      } else {
        // 如果没有markdown容器，直接提取回答元素的内容
        answer = this.extractText(answerEl).trim();
        answerHtml = this.extractHtml(answerEl).trim();
      }
      
      if (!answer || answer.length < 20) {
        continue;
      }
      
      // 生成唯一ID（基于内容，确保相同对话生成相同ID）
      const id = this.generateId(questionEl, question, answer);
      
      // 检查是否已经处理过这个对话（避免同一会话中重复提取）
      if (seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      
      // 提取问题的HTML格式
      const questionHtml = this.extractHtml(questionEl).trim();
      
      conversations.push({
        id,
        timestamp: Date.now(),
        platform: this.name,
        domain: window.location.hostname,
        question,
        answer,
        questionHtml: questionHtml || undefined,
        answerHtml: answerHtml || undefined,
        title: conversationTitle || undefined,
        pageUrl: window.location.href
      });
    }
    
    return conversations;
  }
  
  /**
   * 判断是否是日期分类文本（如"昨天"、"7天内"等）
   */
  private isDateCategory(text: string): boolean {
    const dateKeywords = [
      '昨天', '今天', '明天',
      '7天内', '30天内', '7天', '30天',
      '一周内', '一个月内', '一年内',
      'yesterday', 'today', 'tomorrow',
      '7 days', '30 days', 'week', 'month', 'year'
    ];
    
    const lowerText = text.toLowerCase();
    return dateKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  }
  
  /**
   * 验证是否是有效的标题
   */
  private isValidTitle(text: string): boolean {
    // 标题应该：
    // 1. 长度大于3
    // 2. 不是纯数字或hash值
    // 3. 不是UUID格式（包含连字符的36字符字符串）
    // 4. 包含至少一个中文字符或字母
    if (text.length < 3) return false;
    
    // 检查是否是UUID格式（例如：54afa1a3-2865-47ac-b72a-ab8fd84d968c）
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(text)) return false;
    
    // 检查是否是hash值（纯16进制字符，长度>=16）
    if (/^[a-f0-9]{16,}$/i.test(text)) return false;
    
    // 检查是否包含中文字符或字母
    if (!/[\u4e00-\u9fa5a-zA-Z]/.test(text)) return false;
    
    return true;
  }
}
