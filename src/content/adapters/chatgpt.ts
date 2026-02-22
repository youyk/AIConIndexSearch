import { BaseAdapter } from './base';
import { Conversation } from '../../shared/types';

export class ChatGPTAdapter extends BaseAdapter {
  name = 'ChatGPT';

  detect(): boolean {
    return window.location.hostname.includes('chat.openai.com');
  }

  extractConversations(): Conversation[] {
    const conversations: Conversation[] = [];
    const seenIds = new Set<string>(); // 用于去重，避免同一会话中重复提取
    
    // ChatGPT的对话结构 - 尝试多种选择器
    const selectors = [
      '[data-testid*="conversation-turn"]',
      'div[class*="group"]',
      'div[class*="message"]'
    ];

    let messageGroups: NodeListOf<Element> | null = null;
    for (const selector of selectors) {
      messageGroups = document.querySelectorAll(selector);
      if (messageGroups.length > 0) break;
    }

    if (!messageGroups || messageGroups.length === 0) {
      return conversations;
    }

    messageGroups.forEach((group) => {
      // 查找用户消息
      const userSelectors = [
        '[data-message-author-role="user"]',
        'div[class*="user"]',
        'div:has-text'
      ];
      
      let questionEl: Element | null = null;
      for (const sel of userSelectors) {
        questionEl = group.querySelector(sel);
        if (questionEl) break;
      }

      // 查找AI回答
      const assistantSelectors = [
        '[data-message-author-role="assistant"]',
        'div[class*="assistant"]',
        'div[class*="model"]'
      ];
      
      let answerEl: Element | null = null;
      for (const sel of assistantSelectors) {
        answerEl = group.querySelector(sel);
        if (answerEl) break;
      }

      if (questionEl && answerEl) {
        const question = this.extractText(questionEl).trim();
        const answer = this.extractText(answerEl).trim();

        if (question && answer && question.length > 5 && answer.length > 10) {
          // 生成唯一ID（基于内容，确保相同对话生成相同ID）
          const id = this.generateId(group, question, answer);
          
          // 检查是否已经处理过这个对话（避免同一会话中重复提取）
          if (seenIds.has(id)) {
            return;
          }
          seenIds.add(id);
          
          // 提取HTML格式（用于导出和显示）
          const questionHtml = this.extractHtml(questionEl);
          const answerHtml = this.extractHtml(answerEl);
          
          conversations.push({
            id,
            timestamp: Date.now(),
            platform: this.name,
            domain: window.location.hostname,
            question,
            answer,
            questionHtml: questionHtml || undefined,
            answerHtml: answerHtml || undefined,
            pageUrl: window.location.href
          });
        }
      }
    });

    return conversations;
  }
}
