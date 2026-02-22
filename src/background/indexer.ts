import { Conversation, SearchOptions, SearchResult } from '../shared/types';
import { ConversationStorage } from '../shared/storage';
import { escapeRegex } from '../shared/utils';

// 使用简化的搜索实现（不依赖FlexSearch，使用原生字符串搜索）
export class ConversationIndexer {
  private storage: ConversationStorage;
  private index: Map<string, string> = new Map(); // id -> searchable text

  constructor() {
    this.storage = new ConversationStorage();
  }

  async init(): Promise<void> {
    await this.storage.init();
    await this.rebuildIndex();
  }

  async addConversation(conv: Conversation): Promise<void> {
    // 保存到IndexedDB
    await this.storage.save(conv);

    // 建立搜索索引
    const searchableText = [
      conv.question,
      conv.answer,
      conv.tags?.join(' '),
      conv.category,
      conv.notes
    ].filter(Boolean).join(' ').toLowerCase();

    this.index.set(conv.id, searchableText);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const allConversations = await this.storage.getAll();
    const results: SearchResult[] = [];

    for (const conv of allConversations) {
      const searchableText = this.index.get(conv.id) || '';
      
      // 简单的文本匹配
      if (searchableText.includes(queryLower)) {
        const score = this.calculateScore(conv, queryLower);
        const highlights = this.generateHighlights(conv, query);

        results.push({
          conversation: conv,
          score,
          highlights
        });
      }
    }

    // 应用筛选条件
    let filtered = results;
    
    if (options?.platform) {
      filtered = filtered.filter(r => r.conversation.platform === options.platform);
    }

    if (options?.tags && options.tags.length > 0) {
      filtered = filtered.filter(r =>
        r.conversation.tags?.some(tag => options.tags!.includes(tag))
      );
    }

    if (options?.startDate || options?.endDate) {
      filtered = filtered.filter(r => {
        const timestamp = r.conversation.timestamp;
        if (options.startDate && timestamp < options.startDate) return false;
        if (options.endDate && timestamp > options.endDate) return false;
        return true;
      });
    }

    // 排序
    if (options?.sortBy === 'time') {
      filtered.sort((a, b) => b.conversation.timestamp - a.conversation.timestamp);
    } else {
      filtered.sort((a, b) => b.score - a.score);
    }

    // 限制结果数量
    const limit = options?.limit || 50;
    return filtered.slice(0, limit);
  }

  private calculateScore(conv: Conversation, query: string): number {
    const questionLower = conv.question.toLowerCase();
    const answerLower = conv.answer.toLowerCase();

    let score = 0;

    // 问题中的匹配权重更高
    if (questionLower.includes(query)) score += 10;
    if (answerLower.includes(query)) score += 5;

    // 精确匹配加分
    const questionWords = questionLower.split(/\s+/);
    const answerWords = answerLower.split(/\s+/);
    const queryWords = query.split(/\s+/);

    queryWords.forEach(qw => {
      if (questionWords.includes(qw)) score += 3;
      if (answerWords.includes(qw)) score += 1;
    });

    return score;
  }

  private generateHighlights(conv: Conversation, query: string): { question: string[]; answer: string[] } {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');

    const questionMatches = conv.question.match(regex) || [];
    const answerMatches = conv.answer.match(regex) || [];

    return {
      question: [...new Set(questionMatches)],
      answer: [...new Set(answerMatches)]
    };
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    const existing = await this.storage.get(id);
    if (!existing) return;

    const updated = { ...existing, ...updates };
    await this.storage.save(updated);

    // 重新索引
    const searchableText = [
      updated.question,
      updated.answer,
      updated.tags?.join(' '),
      updated.category,
      updated.notes
    ].filter(Boolean).join(' ').toLowerCase();

    this.index.set(id, searchableText);
  }

  async deleteConversation(id: string): Promise<void> {
    await this.storage.delete(id);
    this.index.delete(id);
  }

  async rebuildIndex(): Promise<void> {
    this.index.clear();
    const conversations = await this.storage.getAll();

    for (const conv of conversations) {
      const searchableText = [
        conv.question,
        conv.answer,
        conv.tags?.join(' '),
        conv.category,
        conv.notes
      ].filter(Boolean).join(' ').toLowerCase();

      this.index.set(conv.id, searchableText);
    }
  }
}
