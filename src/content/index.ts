import { DomainConfigManager } from '../shared/domain-config';
import { detectPlatform } from './adapters';
import { Conversation } from '../shared/types';

class ConversationCapture {
  private observer: MutationObserver | null = null;
  private platformAdapter = detectPlatform();
  private capturedIds = new Set<string>();
  private existingIds = new Set<string>(); // 已存在于数据库的ID
  private debounceTimer: number | null = null;
  private domainConfig = new DomainConfigManager();
  private initialScanDone = false;
  private isProcessing = false; // 防止并发处理
  private lastCheckTime = 0; // 上次检查时间，用于节流
  private readonly THROTTLE_INTERVAL = 3000; // 节流间隔：3秒
  private readonly DEBOUNCE_DELAY = 2000; // 防抖延迟：2秒
  private visibilityChangeHandler: (() => void) | null = null;

  async init(): Promise<void> {
    // 检查当前域名是否在配置列表中
    const currentDomain = window.location.hostname;
    const isTracked = await this.domainConfig.isDomainTracked(currentDomain);

    if (!isTracked) {
      return; // 域名未跟踪，静默退出
    }

    if (!this.platformAdapter) {
      return; // 无适配器，静默退出
    }

    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.startObserving();
      });
    } else {
      this.startObserving();
    }
  }

  private startObserving(): void {
    // 立即进行初始提取，获取所有历史对话
    this.performInitialScan();

    // 获取平台特定的观察目标（如果适配器提供了）
    const observeTarget = this.getObserveTarget();
    
    // 监听DOM变化，使用智能过滤
    this.observer = new MutationObserver((mutations) => {
      // 检查页面可见性
      if (document.hidden) {
        return; // 页面不可见时，不处理变化
      }

      // 检查是否有相关的变化（只关注可能包含对话的元素）
      if (!this.hasRelevantChanges(mutations)) {
        return; // 没有相关变化，跳过处理
      }

      // 节流：限制检查频率
      const now = Date.now();
      if (now - this.lastCheckTime < this.THROTTLE_INTERVAL) {
        return; // 节流：距离上次检查时间太短
      }

      // 防抖处理，等待流式输出完成
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = window.setTimeout(() => {
        this.detectNewConversations();
        this.lastCheckTime = Date.now();
      }, this.DEBOUNCE_DELAY);
    });

    // 只观察目标元素，而不是整个body
    this.observer.observe(observeTarget, {
      childList: true,
      subtree: true,
      characterData: false // 关闭字符数据监听，减少回调
    });
    
    // 监听页面可见性变化
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * 获取观察目标元素（尝试找到对话容器，减少观察范围）
   */
  private getObserveTarget(): Node {
    if (!this.platformAdapter) {
      return document.body;
    }

    // 尝试找到平台特定的对话容器
    // Gemini: #chat-history
    // ChatGPT: 通常在主容器中
    // DeepSeek: 右侧的 ds-scroll-area
    
    const geminiContainer = document.getElementById('chat-history');
    if (geminiContainer) {
      return geminiContainer;
    }

    // DeepSeek: 查找包含消息的 ds-scroll-area
    const deepseekContainers = document.querySelectorAll('.ds-scroll-area');
    for (const container of deepseekContainers) {
      if (container.querySelector('.ds-message')) {
        return container;
      }
    }

    // ChatGPT: 查找主对话容器
    const chatgptContainer = document.querySelector('[data-testid*="conversation"], main, [role="main"]');
    if (chatgptContainer) {
      return chatgptContainer;
    }

    // 默认观察body，但只在必要时
    return document.body;
  }

  /**
   * 检查mutations是否包含与对话相关的变化
   */
  private hasRelevantChanges(mutations: MutationRecord[]): boolean {
    if (!this.platformAdapter) return false;

    // 检查是否有添加或修改的节点包含对话相关的元素
    for (const mutation of mutations) {
      // 检查添加的节点
      if (mutation.addedNodes.length > 0) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            // 检查是否包含对话相关的类名或ID
            if (this.isConversationElement(element)) {
              return true;
            }
          }
        }
      }

      // 检查修改的节点
      if (mutation.type === 'childList' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        const element = mutation.target as Element;
        if (this.isConversationElement(element)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查元素是否可能是对话相关的
   */
  private isConversationElement(element: Element): boolean {
    const className = element.className || '';
    const id = element.id || '';
    const tagName = element.tagName.toLowerCase();

    // 平台特定的特征
    const platformHints = [
      // Gemini
      'conversation-container',
      'user-query-container',
      'response-container-content',
      'chat-history',
      // ChatGPT
      'message',
      'conversation',
      // DeepSeek
      'ds-message',
      'ds-markdown',
      'ds-markdown-paragraph'
    ];

    // 检查类名或ID是否包含提示
    const text = `${className} ${id}`.toLowerCase();
    if (platformHints.some(hint => text.includes(hint))) {
      return true;
    }

    // 递归检查子元素（限制深度）
    let depth = 0;
    const maxDepth = 2;
    const checkChildren = (el: Element, currentDepth: number): boolean => {
      if (currentDepth > maxDepth) return false;
      
      for (const child of Array.from(el.children)) {
        const childClass = child.className || '';
        const childId = child.id || '';
        const childText = `${childClass} ${childId}`.toLowerCase();
        if (platformHints.some(hint => childText.includes(hint))) {
          return true;
        }
        if (checkChildren(child, currentDepth + 1)) {
          return true;
        }
      }
      return false;
    };

    return checkChildren(element, 0);
  }

  /**
   * 执行初始扫描，提取所有历史对话并检查哪些已存在
   */
  private async performInitialScan(): Promise<void> {
    if (!this.platformAdapter) return;

    // 检查扩展上下文是否有效
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('[AI KB] Extension context invalidated. Please reload the page.');
      this.stopObserving();
      return;
    }

    try {
      // 等待DOM完全加载
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const conversations = this.platformAdapter.extractConversations();

      if (conversations.length === 0) {
        this.initialScanDone = true;
        return;
      }

      // 查询哪些对话已存在
      const ids = conversations.map(c => c.id);
      const existingIds = await this.checkExistingIds(ids);
      existingIds.forEach(id => {
        this.existingIds.add(id);
        this.capturedIds.add(id); // 标记为已处理
      });

      // 发送新对话
      for (const conv of conversations) {
        if (!this.capturedIds.has(conv.id) && !this.existingIds.has(conv.id)) {
          this.capturedIds.add(conv.id);
          await this.sendToBackground(conv);
        }
      }

      this.initialScanDone = true;
    } catch (error: any) {
      // 检查是否是上下文失效错误
      if (error && error.message && error.message.includes('Extension context invalidated')) {
        this.stopObserving();
      }
      // 其他错误静默处理，避免影响页面性能
    }
  }

  /**
   * 检查哪些对话ID已存在于数据库
   */
  private async checkExistingIds(ids: string[]): Promise<string[]> {
    return new Promise((resolve) => {
      if (!chrome.runtime || !chrome.runtime.id) {
        resolve([]);
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'CHECK_CONVERSATION_IDS', ids },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve([]);
            return;
          }
          resolve(response?.existingIds || []);
        }
      );
    });
  }

  /**
   * 检测新对话（用于DOM变化监听）
   */
  private detectNewConversations(): void {
    if (!this.platformAdapter || !this.initialScanDone) return;
    
    // 防止并发处理
    if (this.isProcessing) {
      return;
    }

    // 检查页面可见性
    if (document.hidden) {
      return;
    }

    // 检查扩展上下文是否有效
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('[AI KB] Extension context invalidated. Please reload the page.');
      this.stopObserving();
      return;
    }

    this.isProcessing = true;

    try {
      const conversations = this.platformAdapter.extractConversations();
      
      // 如果没有检测到对话，可能是页面还在加载，不记录日志
      if (conversations.length === 0) {
        this.isProcessing = false;
        return;
      }

      // 过滤出真正的新对话（既不在capturedIds中，也不在existingIds中）
      const newConversations = conversations.filter(conv => {
        return !this.capturedIds.has(conv.id) && !this.existingIds.has(conv.id);
      });

      if (newConversations.length === 0) {
        this.isProcessing = false;
        return; // 没有新对话，直接返回
      }

      // 批量发送新对话（异步，不阻塞）
      this.sendNewConversations(newConversations).finally(() => {
        this.isProcessing = false;
      });
    } catch (error: any) {
      this.isProcessing = false;
      // 检查是否是上下文失效错误
      if (error && error.message && error.message.includes('Extension context invalidated')) {
        this.stopObserving();
      }
      // 其他错误静默处理
    }
  }

  /**
   * 批量发送新对话（异步处理，不阻塞）
   */
  private async sendNewConversations(conversations: Conversation[]): Promise<void> {
    for (const conv of conversations) {
      // 立即标记为已捕获，避免重复处理
      this.capturedIds.add(conv.id);
      await this.sendToBackground(conv);
      
      // 添加小延迟，避免过快的消息发送
      if (conversations.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  private async sendToBackground(conv: Conversation): Promise<void> {
    // 检查扩展上下文是否有效
    if (!chrome.runtime || !chrome.runtime.id) {
      return;
    }

    return new Promise((resolve) => {
      if (!chrome.runtime || !chrome.runtime.id) {
        resolve();
        return;
      }

      try {
        chrome.runtime.sendMessage({
          type: 'NEW_CONVERSATION',
          data: {
            ...conv,
            domain: window.location.hostname,
            pageUrl: window.location.href
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            // 如果上下文失效，停止观察
            if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
              this.stopObserving();
            }
            resolve();
            return;
          }
          
          if (response && response.success) {
            if (response.duplicate) {
              this.existingIds.add(conv.id);
            }
            // 检查存储警告
            if (response.storageWarning) {
              // 存储警告通过消息传递，由popup显示
            }
          }
          resolve();
        });
      } catch (err: any) {
        if (err.message && err.message.includes('Extension context invalidated')) {
          this.stopObserving();
        }
        resolve();
      }
    });
  }

  private stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
  }
}

// 初始化
const capture = new ConversationCapture();
capture.init();
