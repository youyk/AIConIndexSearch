import { Conversation, ExportOptions, ExportFilters } from './types';
import { ConversationStorage } from './storage';
import { escapeHtml, formatDate } from './utils';

export class ExportManager {
  private storage: ConversationStorage;

  constructor(storage: ConversationStorage) {
    this.storage = storage;
  }

  async export(
    format: 'json' | 'markdown' | 'html' | 'csv' | 'pdf',
    options?: ExportOptions
  ): Promise<string> {
    let conversations: Conversation[];

    if (options?.conversationIds && options.conversationIds.length > 0) {
      conversations = await Promise.all(
        options.conversationIds.map(id => this.storage.get(id))
      );
      conversations = conversations.filter((c): c is Conversation => c !== null);
    } else {
      conversations = await this.storage.getAll();

      if (options?.filters) {
        conversations = this.applyFilters(conversations, options.filters);
      }
    }

    switch (format) {
      case 'json':
        return this.exportToJSON(conversations);
      case 'markdown':
        return this.exportToMarkdown(conversations);
      case 'html':
        return this.exportToHTML(conversations);
      case 'csv':
        return this.exportToCSV(conversations);
      case 'pdf':
        // PDF导出需要特殊处理，返回HTML内容用于转换
        return this.exportToHTML(conversations);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 导出为PDF（在popup中调用，因为需要DOM操作）
   */
  async exportToPDF(conversations: Conversation[]): Promise<void> {
    // 这个方法应该在popup中实现，因为需要访问DOM和html2pdf.js
    // 这里只返回HTML内容，实际的PDF转换在popup中进行
    throw new Error('exportToPDF should be called from popup context');
  }

  private applyFilters(conversations: Conversation[], filters: ExportFilters): Conversation[] {
    let filtered = conversations;

    if (filters.platform) {
      filtered = filtered.filter(c => c.platform === filters.platform);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(c =>
        c.tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter(c => {
        if (filters.startDate && c.timestamp < filters.startDate) return false;
        if (filters.endDate && c.timestamp > filters.endDate) return false;
        return true;
      });
    }

    if (filters.favoriteOnly) {
      filtered = filtered.filter(c => c.favorite);
    }

    return filtered;
  }

  private exportToJSON(conversations: Conversation[]): string {
    return JSON.stringify(conversations, null, 2);
  }

  private exportToMarkdown(conversations: Conversation[]): string {
    return conversations.map(conv => {
      const date = formatDate(conv.timestamp);
      const tags = conv.tags && conv.tags.length > 0
        ? `\n**标签：** ${conv.tags.join(', ')}`
        : '';
      const notes = conv.notes ? `\n**笔记：** ${conv.notes}` : '';
      const favorite = conv.favorite ? ' ⭐' : '';

      // 将HTML转换为Markdown（简化版）
      const questionText = this.htmlToMarkdown(conv.questionHtml || conv.question);
      const answerText = this.htmlToMarkdown(conv.answerHtml || conv.answer);

      return `## ${date} - ${conv.platform}${favorite}

**问题：**
${questionText}

**回答：**
${answerText}
${tags}${notes}

---
`;
    }).join('\n');
  }

  /**
   * 将HTML转换为Markdown（简化版）
   */
  private htmlToMarkdown(html: string): string {
    if (!html) return '';
    
    // 如果已经是纯文本，直接返回
    if (!html.includes('<')) return html;
    
    let markdown = html;
    
    // 转换常见HTML标签为Markdown
    markdown = markdown
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```')
      .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<ul[^>]*>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '\n')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<div[^>]*>(.*?)<\/div>/gis, '$1\n')
      .replace(/<span[^>]*>(.*?)<\/span>/gi, '$1');
    
    // 移除所有剩余的HTML标签
    markdown = markdown.replace(/<[^>]+>/g, '');
    
    // 清理多余的空行
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    
    return markdown.trim();
  }

  private exportToHTML(conversations: Conversation[]): string {
    const date = new Date().toLocaleString('zh-CN');
    const total = conversations.length;

    const conversationsHTML = conversations.map((conv, index) => {
      const dateStr = formatDate(conv.timestamp);
      const tags = conv.tags && conv.tags.length > 0
        ? `<div class="tags">${conv.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';
      const notes = conv.notes ? `<div class="notes"><strong>笔记：</strong>${escapeHtml(conv.notes)}</div>` : '';
      const favorite = conv.favorite ? '<span class="favorite">⭐</span>' : '';

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
              <div class="label">问题：</div>
              <div class="text ${conv.questionHtml ? 'formatted-content' : ''}">${conv.questionHtml ? this.sanitizeHtml(conv.questionHtml) : this.formatText(conv.question)}</div>
            </div>
            <div class="answer">
              <div class="label">回答：</div>
              <div class="text ${conv.answerHtml ? 'formatted-content' : ''}">${conv.answerHtml ? this.sanitizeHtml(conv.answerHtml) : this.formatText(conv.answer)}</div>
            </div>
            ${tags}
            ${notes}
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI对话知识库导出 - ${escapeHtml(date)}</title>
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
      <h1>AI对话知识库导出</h1>
      <div class="meta">
        导出时间：${escapeHtml(date)} | 共 ${total} 条对话
      </div>
    </div>
    ${conversationsHTML}
  </div>
</body>
</html>`;
  }

  private exportToCSV(conversations: Conversation[]): string {
    const headers = ['时间', '平台', '问题', '回答', '标签', '笔记', '收藏'];
    const rows = conversations.map(conv => [
      formatDate(conv.timestamp),
      conv.platform,
      this.escapeCsv(conv.question),
      this.escapeCsv(conv.answer),
      conv.tags?.join(';') || '',
      this.escapeCsv(conv.notes || ''),
      conv.favorite ? '是' : '否'
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  private formatText(text: string): string {
    return escapeHtml(text)
      .replace(/\n/g, '<br>')
      .replace(/\r\n/g, '<br>');
  }

  /**
   * 清理和保留HTML格式（用于导出）
   * 移除危险脚本，但保留格式标签
   * 使用纯字符串处理，不依赖DOM API（适用于service worker）
   */
  private sanitizeHtml(html: string): string {
    if (!html) return '';
    
    let sanitized = html;
    
    // 1. 移除危险标签及其内容
    const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link'];
    dangerousTags.forEach(tag => {
      // 移除自闭合标签
      sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*/?>`, 'gi'), '');
      // 移除成对标签及其内容
      sanitized = sanitized.replace(new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis'), '');
    });
    
    // 2. 移除事件处理器属性（onclick, onerror等）
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
    
    // 3. 定义允许的标签
    const allowedTags = ['p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                        'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr'];
    
    // 4. 清理不允许的标签（保留内容，移除标签）
    // 先找出所有标签
    const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
    sanitized = sanitized.replace(tagPattern, (match, closing, tagName, attributes) => {
      const lowerTag = tagName.toLowerCase();
      
      // 如果是允许的标签
      if (allowedTags.includes(lowerTag)) {
        // 清理属性，只保留安全的属性
        let cleanAttributes = '';
        
        if (lowerTag === 'a') {
          // 链接：保留href，添加target和rel
          const hrefMatch = attributes.match(/href\s*=\s*["']([^"']*)["']/i);
          if (hrefMatch) {
            cleanAttributes = ` href="${escapeHtml(hrefMatch[1])}" target="_blank" rel="noopener noreferrer"`;
          }
        } else if (lowerTag === 'img') {
          // 图片：只保留src（如果是安全的）
          const srcMatch = attributes.match(/src\s*=\s*["']([^"']*)["']/i);
          if (srcMatch) {
            const src = srcMatch[1];
            // 只保留base64或http/https链接
            if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
              cleanAttributes = ` src="${escapeHtml(src)}"`;
            } else {
              // 不安全的src，移除整个img标签
              return '';
            }
          } else {
            // 没有src，移除整个img标签
            return '';
          }
        } else {
          // 其他标签：移除所有属性（保留基本格式）
          // 但保留一些基本属性如class（用于样式）
          const classMatch = attributes.match(/class\s*=\s*["']([^"']*)["']/i);
          if (classMatch) {
            cleanAttributes = ` class="${escapeHtml(classMatch[1])}"`;
          }
        }
        
        return `<${closing}${tagName}${cleanAttributes}>`;
      } else {
        // 不允许的标签，移除标签但保留内容
        // 对于自闭合标签，直接移除
        if (closing === '/' || match.endsWith('/>')) {
          return '';
        }
        // 对于成对标签，移除开始和结束标签（内容会在后续处理中保留）
        return '';
      }
    });
    
    // 5. 清理剩余的属性（防止遗漏）
    sanitized = sanitized.replace(/\s+[a-zA-Z-]+\s*=\s*["'][^"']*["']/g, (match) => {
      // 只保留href和src（已经在上面处理过）
      if (match.includes('href=') || match.includes('src=')) {
        return match;
      }
      return '';
    });
    
    // 6. 清理多余的空行和空白
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  private escapeCsv(text: string): string {
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * 下载文件（注意：此方法不能在service worker中使用）
   * 应该在popup或content script中调用
   * 这里保留方法签名，但实际下载应该在popup中处理
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    // 这个方法不应该在background script中被调用
    // 实际的下载应该在popup中通过chrome.downloads API或Blob URL处理
    throw new Error('downloadFile should not be called from background script. Use popup context instead.');
  }
}
