export interface Conversation {
  id: string;
  timestamp: number;
  platform: string;
  domain: string;
  question: string;
  answer: string;
  // 格式化的HTML内容（保留原始格式）
  questionHtml?: string;
  answerHtml?: string;
  // 对话标题（从页面提取）
  title?: string;
  tags?: string[];
  category?: string;
  notes?: string;
  favorite?: boolean;
  sessionId?: string;
  pageUrl?: string;
}

export interface TrackedDomain {
  domain: string;
  enabled: boolean;
  name?: string;
}

export interface SearchOptions {
  limit?: number;
  platform?: string;
  tags?: string[];
  startDate?: number;
  endDate?: number;
  sortBy?: 'relevance' | 'time';
}

export interface SearchResult {
  conversation: Conversation;
  score: number;
  highlights: {
    question: string[];
    answer: string[];
  };
}

export interface ExportOptions {
  conversationIds?: string[];
  filters?: ExportFilters;
  format?: 'json' | 'markdown' | 'html' | 'csv' | 'pdf';
}

export interface ExportFilters {
  platform?: string;
  tags?: string[];
  startDate?: number;
  endDate?: number;
  favoriteOnly?: boolean;
}

export interface PlatformAdapter {
  name: string;
  detect(): boolean;
  extractConversations(): Conversation[];
  setupListener(callback: (conv: Conversation) => void): void;
}
