import { BaseAdapter } from './base';
import { Conversation } from '../../shared/types';

export class GeminiAdapter extends BaseAdapter {
  name = 'Gemini';

  detect(): boolean {
    return window.location.hostname.includes('gemini.google.com');
  }

  extractConversations(): Conversation[] {
    const conversations: Conversation[] = [];
    const seenIds = new Set<string>(); // 用于去重，避免同一会话中重复提取
    
    // 策略：按照用户提供的结构提取
    // 1. 找到 id="chat-history" 的元素
    // 2. 在其中查找所有 conversation-container
    // 3. 每个 conversation-container 包含：
    //    - user-query-container (用户提问)
    //    - response-container-content (AI回复)
    
    const chatHistory = document.getElementById('chat-history');
    
    if (!chatHistory) {
      return conversations;
    }
    
    // 提取对话标题（conversation-title）
    let conversationTitle: string | undefined = undefined;
    const titleElement = document.querySelector('[class*="conversation-title"]');
    if (titleElement) {
      conversationTitle = this.extractText(titleElement).trim();
    }
    
    // 查找所有 conversation-container
    const conversationContainers = chatHistory.querySelectorAll('[class*="conversation-container"]');
    
    if (conversationContainers.length === 0) {
      return conversations;
    }
    
    // 处理每个 conversation-container
    conversationContainers.forEach((container) => {
      // 查找用户提问
      const userQueryContainer = container.querySelector('[class*="user-query-container"]');
      if (!userQueryContainer) {
        return;
      }
      
      // 查找AI回复
      const responseContainer = container.querySelector('[class*="response-container-content"]');
      if (!responseContainer) {
        return;
      }
      
      // 提取文本（用于搜索）
      const question = this.extractText(userQueryContainer).trim();
      const answer = this.extractText(responseContainer).trim();
      
      if (!question || question.length < 5) {
        return;
      }
      
      if (!answer || answer.length < 20) {
        return;
      }
      
      // 生成唯一ID（基于内容，确保相同对话生成相同ID）
      const id = this.generateId(container, question, answer);
      
      // 检查是否已经处理过这个对话（避免同一会话中重复提取）
      if (seenIds.has(id)) {
        return;
      }
      seenIds.add(id);
      
      // 提取HTML格式（用于导出和显示）
      const questionHtml = this.extractHtml(userQueryContainer);
      const answerHtml = this.extractHtml(responseContainer);
      
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
    });
    
    return conversations;
  }
}
