import { Conversation } from './types';

export class ConversationStorage {
  private dbName = 'ai-conversation-kb';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  
  // 存储限制配置
  private readonly MAX_STORAGE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly WARNING_THRESHOLD = 0.8; // 80%时警告
  private readonly CRITICAL_THRESHOLD = 0.95; // 95%时严重警告

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('platform', 'platform', { unique: false });
          store.createIndex('domain', 'domain', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
      };
    });
  }

  async save(conv: Conversation): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.put(conv);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(id: string): Promise<Conversation | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<Conversation[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPlatforms(): Promise<string[]> {
    const conversations = await this.getAll();
    return [...new Set(conversations.map(c => c.platform))];
  }

  async getTags(): Promise<string[]> {
    const conversations = await this.getAll();
    const allTags = conversations
      .flatMap(c => c.tags || [])
      .filter(Boolean);
    return [...new Set(allTags)];
  }

  /**
   * 批量检查哪些对话ID已存在（高效查询）
   */
  async checkExistingIds(ids: string[]): Promise<string[]> {
    if (!this.db) await this.init();
    if (ids.length === 0) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const existingIds: string[] = [];
      let completed = 0;

      ids.forEach(id => {
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
            resolve(existingIds); // 即使有错误也返回已找到的ID
          }
        };
      });
    });
  }

  /**
   * 获取统计数据
   */
  async getStatistics(): Promise<{
    totalCount: number;
    totalSize: number;
    sizeFormatted: string;
    platforms: { [key: string]: number };
    oldestDate: number | null;
    newestDate: number | null;
  }> {
    const conversations = await this.getAll();
    const totalCount = conversations.length;
    
    // 计算总大小（估算）
    const totalSize = conversations.reduce((size, conv) => {
      const json = JSON.stringify(conv);
      return size + new Blob([json]).size;
    }, 0);
    
    // 格式化大小
    const sizeFormatted = this.formatBytes(totalSize);
    
    // 按平台统计
    const platforms: { [key: string]: number } = {};
    conversations.forEach(conv => {
      platforms[conv.platform] = (platforms[conv.platform] || 0) + 1;
    });
    
    // 时间范围
    const timestamps = conversations.map(c => c.timestamp).filter(Boolean);
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
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 获取存储位置信息
   */
  getStorageLocation(): string {
    // IndexedDB存储在浏览器的用户数据目录中
    // Chrome (macOS): ~/Library/Application Support/Google/Chrome/Default/IndexedDB/
    // Chrome (Windows): %LOCALAPPDATA%\Google\Chrome\User Data\Default\IndexedDB\
    // Chrome (Linux): ~/.config/google-chrome/Default/IndexedDB/
    // 数据库名称: ai-conversation-kb
    const userAgent = navigator.userAgent;
    let osInfo = '未知系统';
    
    if (userAgent.includes('Mac')) {
      osInfo = 'macOS';
    } else if (userAgent.includes('Win')) {
      osInfo = 'Windows';
    } else if (userAgent.includes('Linux')) {
      osInfo = 'Linux';
    }
    
    return `IndexedDB (${osInfo}): ${this.dbName}`;
  }

  /**
   * 检查存储限制
   * 返回是否可以保存新数据，以及警告信息
   */
  async checkStorageLimit(): Promise<{
    canSave: boolean;
    currentSize: number;
    maxSize: number;
    usagePercent: number;
    warning: string | null;
  }> {
    const stats = await this.getStatistics();
    const usagePercent = stats.totalSize / this.MAX_STORAGE_SIZE;
    
    let warning: string | null = null;
    let canSave = true;
    
    if (usagePercent >= 1.0) {
      // 已达到上限
      canSave = false;
      warning = `存储已满（${this.formatBytes(stats.totalSize)}/${this.formatBytes(this.MAX_STORAGE_SIZE)}）。请删除部分对话或导出数据后清理。`;
    } else if (usagePercent >= this.CRITICAL_THRESHOLD) {
      // 严重警告：接近上限
      canSave = true;
      warning = `存储空间严重不足（已使用 ${(usagePercent * 100).toFixed(1)}%）。建议立即清理数据。`;
    } else if (usagePercent >= this.WARNING_THRESHOLD) {
      // 警告：接近上限
      canSave = true;
      warning = `存储空间使用率较高（已使用 ${(usagePercent * 100).toFixed(1)}%），建议定期清理不需要的对话。`;
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
  getStorageLimit(): { maxSize: number; warningThreshold: number; criticalThreshold: number } {
    return {
      maxSize: this.MAX_STORAGE_SIZE,
      warningThreshold: this.WARNING_THRESHOLD,
      criticalThreshold: this.CRITICAL_THRESHOLD
    };
  }
}
