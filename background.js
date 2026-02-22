// src/shared/storage.ts
var ConversationStorage = class {
  constructor() {
    this.dbName = "ai-conversation-kb";
    this.dbVersion = 1;
    this.db = null;
    // 存储限制配置
    this.MAX_STORAGE_SIZE = 100 * 1024 * 1024;
    // 100MB
    this.WARNING_THRESHOLD = 0.8;
    // 80%时警告
    this.CRITICAL_THRESHOLD = 0.95;
  }
  // 95%时严重警告
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("conversations")) {
          const store = db.createObjectStore("conversations", { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("platform", "platform", { unique: false });
          store.createIndex("domain", "domain", { unique: false });
          store.createIndex("tags", "tags", { unique: false, multiEntry: true });
        }
      };
    });
  }
  async save(conv) {
    if (!this.db)
      await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["conversations"], "readwrite");
      const store = transaction.objectStore("conversations");
      const request = store.put(conv);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async get(id) {
    if (!this.db)
      await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["conversations"], "readonly");
      const store = transaction.objectStore("conversations");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  async getAll() {
    if (!this.db)
      await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["conversations"], "readonly");
      const store = transaction.objectStore("conversations");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async delete(id) {
    if (!this.db)
      await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["conversations"], "readwrite");
      const store = transaction.objectStore("conversations");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async getPlatforms() {
    const conversations = await this.getAll();
    return [...new Set(conversations.map((c) => c.platform))];
  }
  async getTags() {
    const conversations = await this.getAll();
    const allTags = conversations.flatMap((c) => c.tags || []).filter(Boolean);
    return [...new Set(allTags)];
  }
  /**
   * 批量检查哪些对话ID已存在（高效查询）
   */
  async checkExistingIds(ids) {
    if (!this.db)
      await this.init();
    if (ids.length === 0)
      return [];
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["conversations"], "readonly");
      const store = transaction.objectStore("conversations");
      const existingIds = [];
      let completed = 0;
      ids.forEach((id) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) {
            existingIds.push(id);
          }
          completed++;
          if (completed === ids.length) {
            resolve(existingIds);
          }
        };
        request.onerror = () => {
          completed++;
          if (completed === ids.length) {
            resolve(existingIds);
          }
        };
      });
    });
  }
  /**
   * 获取统计数据
   */
  async getStatistics() {
    const conversations = await this.getAll();
    const totalCount = conversations.length;
    const totalSize = conversations.reduce((size, conv) => {
      const json = JSON.stringify(conv);
      return size + new Blob([json]).size;
    }, 0);
    const sizeFormatted = this.formatBytes(totalSize);
    const platforms = {};
    conversations.forEach((conv) => {
      platforms[conv.platform] = (platforms[conv.platform] || 0) + 1;
    });
    const timestamps = conversations.map((c) => c.timestamp).filter(Boolean);
    const oldestDate = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestDate = timestamps.length > 0 ? Math.max(...timestamps) : null;
    return {
      totalCount,
      totalSize,
      sizeFormatted,
      platforms,
      oldestDate,
      newestDate
    };
  }
  /**
   * 格式化字节数
   */
  formatBytes(bytes) {
    if (bytes === 0)
      return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  }
  /**
   * 获取存储位置信息
   */
  getStorageLocation() {
    const userAgent = navigator.userAgent;
    let osInfo = "\u672A\u77E5\u7CFB\u7EDF";
    if (userAgent.includes("Mac")) {
      osInfo = "macOS";
    } else if (userAgent.includes("Win")) {
      osInfo = "Windows";
    } else if (userAgent.includes("Linux")) {
      osInfo = "Linux";
    }
    return `IndexedDB (${osInfo}): ${this.dbName}`;
  }
  /**
   * 检查存储限制
   * 返回是否可以保存新数据，以及警告信息
   */
  async checkStorageLimit() {
    const stats = await this.getStatistics();
    const usagePercent = stats.totalSize / this.MAX_STORAGE_SIZE;
    let warning = null;
    let canSave = true;
    if (usagePercent >= 1) {
      canSave = false;
      warning = `\u5B58\u50A8\u5DF2\u6EE1\uFF08${this.formatBytes(stats.totalSize)}/${this.formatBytes(this.MAX_STORAGE_SIZE)}\uFF09\u3002\u8BF7\u5220\u9664\u90E8\u5206\u5BF9\u8BDD\u6216\u5BFC\u51FA\u6570\u636E\u540E\u6E05\u7406\u3002`;
    } else if (usagePercent >= this.CRITICAL_THRESHOLD) {
      canSave = true;
      warning = `\u5B58\u50A8\u7A7A\u95F4\u4E25\u91CD\u4E0D\u8DB3\uFF08\u5DF2\u4F7F\u7528 ${(usagePercent * 100).toFixed(1)}%\uFF09\u3002\u5EFA\u8BAE\u7ACB\u5373\u6E05\u7406\u6570\u636E\u3002`;
    } else if (usagePercent >= this.WARNING_THRESHOLD) {
      canSave = true;
      warning = `\u5B58\u50A8\u7A7A\u95F4\u4F7F\u7528\u7387\u8F83\u9AD8\uFF08\u5DF2\u4F7F\u7528 ${(usagePercent * 100).toFixed(1)}%\uFF09\uFF0C\u5EFA\u8BAE\u5B9A\u671F\u6E05\u7406\u4E0D\u9700\u8981\u7684\u5BF9\u8BDD\u3002`;
    }
    return {
      canSave,
      currentSize: stats.totalSize,
      maxSize: this.MAX_STORAGE_SIZE,
      usagePercent,
      warning
    };
  }
  /**
   * 获取存储限制配置
   */
  getStorageLimit() {
    return {
      maxSize: this.MAX_STORAGE_SIZE,
      warningThreshold: this.WARNING_THRESHOLD,
      criticalThreshold: this.CRITICAL_THRESHOLD
    };
  }
};

// src/shared/utils.ts
function escapeHtml(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN");
}

// src/background/indexer.ts
var ConversationIndexer = class {
  // id -> searchable text
  constructor() {
    this.index = /* @__PURE__ */ new Map();
    this.storage = new ConversationStorage();
  }
  async init() {
    await this.storage.init();
    await this.rebuildIndex();
  }
  async addConversation(conv) {
    var _a;
    await this.storage.save(conv);
    const searchableText = [
      conv.question,
      conv.answer,
      (_a = conv.tags) == null ? void 0 : _a.join(" "),
      conv.category,
      conv.notes
    ].filter(Boolean).join(" ").toLowerCase();
    this.index.set(conv.id, searchableText);
  }
  async search(query, options) {
    if (!query.trim()) {
      return [];
    }
    const queryLower = query.toLowerCase();
    const allConversations = await this.storage.getAll();
    const results = [];
    for (const conv of allConversations) {
      const searchableText = this.index.get(conv.id) || "";
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
    let filtered = results;
    if (options == null ? void 0 : options.platform) {
      filtered = filtered.filter((r) => r.conversation.platform === options.platform);
    }
    if ((options == null ? void 0 : options.tags) && options.tags.length > 0) {
      filtered = filtered.filter(
        (r) => {
          var _a;
          return (_a = r.conversation.tags) == null ? void 0 : _a.some((tag) => options.tags.includes(tag));
        }
      );
    }
    if ((options == null ? void 0 : options.startDate) || (options == null ? void 0 : options.endDate)) {
      filtered = filtered.filter((r) => {
        const timestamp = r.conversation.timestamp;
        if (options.startDate && timestamp < options.startDate)
          return false;
        if (options.endDate && timestamp > options.endDate)
          return false;
        return true;
      });
    }
    if ((options == null ? void 0 : options.sortBy) === "time") {
      filtered.sort((a, b) => b.conversation.timestamp - a.conversation.timestamp);
    } else {
      filtered.sort((a, b) => b.score - a.score);
    }
    const limit = (options == null ? void 0 : options.limit) || 50;
    return filtered.slice(0, limit);
  }
  calculateScore(conv, query) {
    const questionLower = conv.question.toLowerCase();
    const answerLower = conv.answer.toLowerCase();
    let score = 0;
    if (questionLower.includes(query))
      score += 10;
    if (answerLower.includes(query))
      score += 5;
    const questionWords = questionLower.split(/\s+/);
    const answerWords = answerLower.split(/\s+/);
    const queryWords = query.split(/\s+/);
    queryWords.forEach((qw) => {
      if (questionWords.includes(qw))
        score += 3;
      if (answerWords.includes(qw))
        score += 1;
    });
    return score;
  }
  generateHighlights(conv, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
    const questionMatches = conv.question.match(regex) || [];
    const answerMatches = conv.answer.match(regex) || [];
    return {
      question: [...new Set(questionMatches)],
      answer: [...new Set(answerMatches)]
    };
  }
  async updateConversation(id, updates) {
    var _a;
    const existing = await this.storage.get(id);
    if (!existing)
      return;
    const updated = { ...existing, ...updates };
    await this.storage.save(updated);
    const searchableText = [
      updated.question,
      updated.answer,
      (_a = updated.tags) == null ? void 0 : _a.join(" "),
      updated.category,
      updated.notes
    ].filter(Boolean).join(" ").toLowerCase();
    this.index.set(id, searchableText);
  }
  async deleteConversation(id) {
    await this.storage.delete(id);
    this.index.delete(id);
  }
  async rebuildIndex() {
    var _a;
    this.index.clear();
    const conversations = await this.storage.getAll();
    for (const conv of conversations) {
      const searchableText = [
        conv.question,
        conv.answer,
        (_a = conv.tags) == null ? void 0 : _a.join(" "),
        conv.category,
        conv.notes
      ].filter(Boolean).join(" ").toLowerCase();
      this.index.set(conv.id, searchableText);
    }
  }
};

// src/shared/export-manager.ts
var ExportManager = class {
  constructor(storage2) {
    this.storage = storage2;
  }
  async export(format, options) {
    let conversations;
    if ((options == null ? void 0 : options.conversationIds) && options.conversationIds.length > 0) {
      conversations = await Promise.all(
        options.conversationIds.map((id) => this.storage.get(id))
      );
      conversations = conversations.filter((c) => c !== null);
    } else {
      conversations = await this.storage.getAll();
      if (options == null ? void 0 : options.filters) {
        conversations = this.applyFilters(conversations, options.filters);
      }
    }
    switch (format) {
      case "json":
        return this.exportToJSON(conversations);
      case "markdown":
        return this.exportToMarkdown(conversations);
      case "html":
        return this.exportToHTML(conversations);
      case "csv":
        return this.exportToCSV(conversations);
      case "pdf":
        return this.exportToHTML(conversations);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  /**
   * 导出为PDF（在popup中调用，因为需要DOM操作）
   */
  async exportToPDF(conversations) {
    throw new Error("exportToPDF should be called from popup context");
  }
  applyFilters(conversations, filters) {
    let filtered = conversations;
    if (filters.platform) {
      filtered = filtered.filter((c) => c.platform === filters.platform);
    }
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(
        (c) => {
          var _a;
          return (_a = c.tags) == null ? void 0 : _a.some((tag) => filters.tags.includes(tag));
        }
      );
    }
    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter((c) => {
        if (filters.startDate && c.timestamp < filters.startDate)
          return false;
        if (filters.endDate && c.timestamp > filters.endDate)
          return false;
        return true;
      });
    }
    if (filters.favoriteOnly) {
      filtered = filtered.filter((c) => c.favorite);
    }
    return filtered;
  }
  exportToJSON(conversations) {
    return JSON.stringify(conversations, null, 2);
  }
  exportToMarkdown(conversations) {
    return conversations.map((conv) => {
      const date = formatDate(conv.timestamp);
      const tags = conv.tags && conv.tags.length > 0 ? `
**\u6807\u7B7E\uFF1A** ${conv.tags.join(", ")}` : "";
      const notes = conv.notes ? `
**\u7B14\u8BB0\uFF1A** ${conv.notes}` : "";
      const favorite = conv.favorite ? " \u2B50" : "";
      const questionText = this.htmlToMarkdown(conv.questionHtml || conv.question);
      const answerText = this.htmlToMarkdown(conv.answerHtml || conv.answer);
      return `## ${date} - ${conv.platform}${favorite}

**\u95EE\u9898\uFF1A**
${questionText}

**\u56DE\u7B54\uFF1A**
${answerText}
${tags}${notes}

---
`;
    }).join("\n");
  }
  /**
   * 将HTML转换为Markdown（简化版）
   */
  htmlToMarkdown(html) {
    if (!html)
      return "";
    if (!html.includes("<"))
      return html;
    let markdown = html;
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n").replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n").replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n").replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n").replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**").replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**").replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*").replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*").replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`").replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```").replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)").replace(/<ul[^>]*>/gi, "\n").replace(/<\/ul>/gi, "\n").replace(/<ol[^>]*>/gi, "\n").replace(/<\/ol>/gi, "\n").replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n").replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n").replace(/<br[^>]*>/gi, "\n").replace(/<div[^>]*>(.*?)<\/div>/gis, "$1\n").replace(/<span[^>]*>(.*?)<\/span>/gi, "$1");
    markdown = markdown.replace(/<[^>]+>/g, "");
    markdown = markdown.replace(/\n{3,}/g, "\n\n");
    return markdown.trim();
  }
  exportToHTML(conversations) {
    const date = (/* @__PURE__ */ new Date()).toLocaleString("zh-CN");
    const total = conversations.length;
    const conversationsHTML = conversations.map((conv, index) => {
      const dateStr = formatDate(conv.timestamp);
      const tags = conv.tags && conv.tags.length > 0 ? `<div class="tags">${conv.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : "";
      const notes = conv.notes ? `<div class="notes"><strong>\u7B14\u8BB0\uFF1A</strong>${escapeHtml(conv.notes)}</div>` : "";
      const favorite = conv.favorite ? '<span class="favorite">\u2B50</span>' : "";
      return `
        <div class="conversation-item">
          <div class="conversation-header">
            <span class="conversation-number">#${index + 1}</span>
            <span class="conversation-date">${escapeHtml(dateStr)}</span>
            <span class="conversation-platform">${escapeHtml(conv.platform)}</span>
            ${favorite}
          </div>
          <div class="conversation-content">
            <div class="question">
              <div class="label">\u95EE\u9898\uFF1A</div>
              <div class="text ${conv.questionHtml ? "formatted-content" : ""}">${conv.questionHtml ? this.sanitizeHtml(conv.questionHtml) : this.formatText(conv.question)}</div>
            </div>
            <div class="answer">
              <div class="label">\u56DE\u7B54\uFF1A</div>
              <div class="text ${conv.answerHtml ? "formatted-content" : ""}">${conv.answerHtml ? this.sanitizeHtml(conv.answerHtml) : this.formatText(conv.answer)}</div>
            </div>
            ${tags}
            ${notes}
          </div>
        </div>
      `;
    }).join("");
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI\u5BF9\u8BDD\u77E5\u8BC6\u5E93\u5BFC\u51FA - ${escapeHtml(date)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .header {
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 24px;
      color: #333;
      margin-bottom: 10px;
    }
    
    .header .meta {
      color: #666;
      font-size: 14px;
    }
    
    .conversation-item {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
      background: #fafafa;
    }
    
    .conversation-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .conversation-number {
      font-weight: bold;
      color: #666;
      font-size: 14px;
    }
    
    .conversation-date {
      color: #888;
      font-size: 13px;
    }
    
    .conversation-platform {
      background: #4a90e2;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .favorite {
      color: #ffa500;
      font-size: 16px;
    }
    
    .conversation-content {
      margin-top: 15px;
    }
    
    .question, .answer {
      margin-bottom: 15px;
    }
    
    .label {
      font-weight: bold;
      color: #4a90e2;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .text {
      color: #333;
      line-height: 1.8;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .text.formatted-content {
      white-space: normal;
    }
    
    .text.formatted-content h1,
    .text.formatted-content h2,
    .text.formatted-content h3,
    .text.formatted-content h4,
    .text.formatted-content h5,
    .text.formatted-content h6 {
      margin: 12px 0 8px 0;
      font-weight: 600;
      color: #333;
    }
    
    .text.formatted-content h1 { font-size: 20px; }
    .text.formatted-content h2 { font-size: 18px; }
    .text.formatted-content h3 { font-size: 16px; }
    .text.formatted-content h4 { font-size: 14px; }
    
    .text.formatted-content p {
      margin: 8px 0;
      line-height: 1.6;
    }
    
    .text.formatted-content ul,
    .text.formatted-content ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    
    .text.formatted-content li {
      margin: 4px 0;
    }
    
    .text.formatted-content code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
    }
    
    .text.formatted-content pre {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }
    
    .text.formatted-content pre code {
      background: none;
      padding: 0;
    }
    
    .text.formatted-content strong,
    .text.formatted-content b {
      font-weight: 600;
    }
    
    .text.formatted-content em,
    .text.formatted-content i {
      font-style: italic;
    }
    
    .text.formatted-content a {
      color: #4a90e2;
      text-decoration: none;
    }
    
    .text.formatted-content a:hover {
      text-decoration: underline;
    }
    
    .text.formatted-content blockquote {
      border-left: 3px solid #ddd;
      padding-left: 12px;
      margin: 8px 0;
      color: #666;
      font-style: italic;
    }
    
    .text.formatted-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    
    .text.formatted-content table th,
    .text.formatted-content table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    
    .text.formatted-content table th {
      background: #f5f5f5;
      font-weight: 600;
    }
    
    .tags {
      margin-top: 15px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .tag {
      background: #e3f2fd;
      color: #1976d2;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
    }
    
    .notes {
      margin-top: 15px;
      padding: 10px;
      background: #fff9c4;
      border-left: 3px solid #fbc02d;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .notes strong {
      color: #f57f17;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        padding: 20px;
      }
      
      .conversation-item {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI\u5BF9\u8BDD\u77E5\u8BC6\u5E93\u5BFC\u51FA</h1>
      <div class="meta">
        \u5BFC\u51FA\u65F6\u95F4\uFF1A${escapeHtml(date)} | \u5171 ${total} \u6761\u5BF9\u8BDD
      </div>
    </div>
    ${conversationsHTML}
  </div>
</body>
</html>`;
  }
  exportToCSV(conversations) {
    const headers = ["\u65F6\u95F4", "\u5E73\u53F0", "\u95EE\u9898", "\u56DE\u7B54", "\u6807\u7B7E", "\u7B14\u8BB0", "\u6536\u85CF"];
    const rows = conversations.map((conv) => {
      var _a;
      return [
        formatDate(conv.timestamp),
        conv.platform,
        this.escapeCsv(conv.question),
        this.escapeCsv(conv.answer),
        ((_a = conv.tags) == null ? void 0 : _a.join(";")) || "",
        this.escapeCsv(conv.notes || ""),
        conv.favorite ? "\u662F" : "\u5426"
      ];
    });
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
  formatText(text) {
    return escapeHtml(text).replace(/\n/g, "<br>").replace(/\r\n/g, "<br>");
  }
  /**
   * 清理和保留HTML格式（用于导出）
   * 移除危险脚本，但保留格式标签
   * 使用纯字符串处理，不依赖DOM API（适用于service worker）
   */
  sanitizeHtml(html) {
    if (!html)
      return "";
    let sanitized = html;
    const dangerousTags = ["script", "style", "iframe", "object", "embed", "form", "input", "button", "meta", "link"];
    dangerousTags.forEach((tag) => {
      sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*/?>`, "gi"), "");
      sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*>.*?</${tag}>`, "gis"), "");
    });
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");
    const allowedTags = [
      "p",
      "div",
      "span",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "hr"
    ];
    const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
    sanitized = sanitized.replace(tagPattern, (match, closing, tagName, attributes) => {
      const lowerTag = tagName.toLowerCase();
      if (allowedTags.includes(lowerTag)) {
        let cleanAttributes = "";
        if (lowerTag === "a") {
          const hrefMatch = attributes.match(/href\s*=\s*["']([^"']*)["']/i);
          if (hrefMatch) {
            cleanAttributes = ` href="${escapeHtml(hrefMatch[1])}" target="_blank" rel="noopener noreferrer"`;
          }
        } else if (lowerTag === "img") {
          const srcMatch = attributes.match(/src\s*=\s*["']([^"']*)["']/i);
          if (srcMatch) {
            const src = srcMatch[1];
            if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
              cleanAttributes = ` src="${escapeHtml(src)}"`;
            } else {
              return "";
            }
          } else {
            return "";
          }
        } else {
          const classMatch = attributes.match(/class\s*=\s*["']([^"']*)["']/i);
          if (classMatch) {
            cleanAttributes = ` class="${escapeHtml(classMatch[1])}"`;
          }
        }
        return `<${closing}${tagName}${cleanAttributes}>`;
      } else {
        if (closing === "/" || match.endsWith("/>")) {
          return "";
        }
        return "";
      }
    });
    sanitized = sanitized.replace(/\s+[a-zA-Z-]+\s*=\s*["'][^"']*["']/g, (match) => {
      if (match.includes("href=") || match.includes("src=")) {
        return match;
      }
      return "";
    });
    sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
    sanitized = sanitized.trim();
    return sanitized;
  }
  escapeCsv(text) {
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
  /**
   * 下载文件（注意：此方法不能在service worker中使用）
   * 应该在popup或content script中调用
   * 这里保留方法签名，但实际下载应该在popup中处理
   */
  downloadFile(content, filename, mimeType) {
    throw new Error("downloadFile should not be called from background script. Use popup context instead.");
  }
};

// src/background/index.ts
var indexer = new ConversationIndexer();
var storage = new ConversationStorage();
var exportManager = new ExportManager(storage);
indexer.init().catch(console.error);
storage.init().catch(console.error);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse).catch(console.error);
  return true;
});
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case "NEW_CONVERSATION":
        const existing = await storage.get(message.data.id);
        if (existing) {
          sendResponse({ success: true, duplicate: true });
        } else {
          const storageCheck = await storage.checkStorageLimit();
          if (!storageCheck.canSave) {
            sendResponse({
              success: false,
              error: "STORAGE_LIMIT_EXCEEDED",
              storageWarning: storageCheck.warning
            });
            break;
          }
          await indexer.addConversation(message.data);
          const newStorageCheck = await storage.checkStorageLimit();
          sendResponse({
            success: true,
            duplicate: false,
            storageWarning: newStorageCheck.warning
          });
        }
        break;
      case "SEARCH_CONVERSATIONS":
        const searchResults = await indexer.search(message.query, message.options);
        sendResponse({ results: searchResults });
        break;
      case "GET_CONVERSATION":
        const conv = await storage.get(message.id);
        sendResponse({ conversation: conv });
        break;
      case "UPDATE_CONVERSATION":
        await indexer.updateConversation(message.id, message.updates);
        sendResponse({ success: true });
        break;
      case "DELETE_CONVERSATION":
        await indexer.deleteConversation(message.id);
        sendResponse({ success: true });
        break;
      case "GET_ALL_CONVERSATIONS":
        const all = await storage.getAll();
        sendResponse({ conversations: all });
        break;
      case "CHECK_CONVERSATION_IDS":
        const idsToCheck = message.ids;
        const existingIds = await storage.checkExistingIds(idsToCheck);
        sendResponse({ existingIds });
        break;
      case "GET_PLATFORMS":
        const platforms = await storage.getPlatforms();
        sendResponse({ platforms });
        break;
      case "GET_TAGS":
        const tags = await storage.getTags();
        sendResponse({ tags });
        break;
      case "GET_STATISTICS":
        const statistics = await storage.getStatistics();
        const storageLocation = storage.getStorageLocation();
        const storageLimit = await storage.checkStorageLimit();
        sendResponse({
          statistics,
          storageLocation,
          storageLimit
        });
        break;
      case "EXPORT_CONVERSATIONS":
        const exportContent = await exportManager.export(
          message.format,
          { conversationIds: message.conversationIds }
        );
        sendResponse({ content: exportContent });
        break;
      default:
        sendResponse({ error: "Unknown message type" });
    }
  } catch (error) {
    console.error("[AI KB Background] Error:", error);
    sendResponse({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
