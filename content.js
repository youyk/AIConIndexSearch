"use strict";
(() => {
  // src/shared/domain-config.ts
  var DomainConfigManager = class {
    constructor() {
      this.storageKey = "trackedDomains";
    }
    async getDomains() {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || this.getDefaultDomains();
    }
    async addDomain(domain, name) {
      const domains = await this.getDomains();
      if (!domains.find((d) => d.domain === domain)) {
        domains.push({
          domain,
          enabled: true,
          name: name || domain
        });
        await chrome.storage.local.set({ [this.storageKey]: domains });
      }
    }
    async removeDomain(domain) {
      const domains = await this.getDomains();
      const filtered = domains.filter((d) => d.domain !== domain);
      await chrome.storage.local.set({ [this.storageKey]: filtered });
    }
    async updateDomain(domain, updates) {
      const domains = await this.getDomains();
      const index = domains.findIndex((d) => d.domain === domain);
      if (index !== -1) {
        domains[index] = { ...domains[index], ...updates };
        await chrome.storage.local.set({ [this.storageKey]: domains });
      }
    }
    async isDomainTracked(domain) {
      const domains = await this.getDomains();
      return domains.some((d) => d.domain === domain && d.enabled);
    }
    getDefaultDomains() {
      return [
        { domain: "gemini.google.com", enabled: true, name: "Google Gemini" },
        { domain: "chat.openai.com", enabled: true, name: "ChatGPT" },
        { domain: "chat.deepseek.com", enabled: true, name: "DeepSeek" },
        { domain: "claude.ai", enabled: true, name: "Claude" }
      ];
    }
  };

  // src/content/adapters/base.ts
  var BaseAdapter = class {
    setupListener(callback) {
    }
    generateId(element, question, answer) {
      const pageUrl = window.location.href;
      const contentHash = this.simpleHash(`${question}|${answer}`);
      const urlHash = this.simpleHash(pageUrl);
      return `${this.name}-${urlHash}-${contentHash}`;
    }
    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    }
    extractText(element) {
      var _a;
      if (!element)
        return "";
      return ((_a = element.textContent) == null ? void 0 : _a.trim()) || "";
    }
    /**
     * 提取HTML内容（保留格式）
     * 清理不需要的属性和脚本，但保留基本格式
     */
    extractHtml(element) {
      if (!element)
        return "";
      const clone = element.cloneNode(true);
      this.cleanHtmlElement(clone);
      return clone.innerHTML.trim();
    }
    /**
     * 清理HTML元素，移除脚本、事件处理器等，但保留格式
     */
    cleanHtmlElement(element) {
      const scripts = element.querySelectorAll("script, style, noscript");
      scripts.forEach((el) => el.remove());
      const attrsToRemove = [
        "onclick",
        "onerror",
        "onload",
        "onmouseover",
        "onmouseout",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
        "onreset",
        "data-test-id",
        "jslog",
        "data-ved",
        "data-hveid",
        "aria-describedby",
        "cdk-describedby-host"
      ];
      attrsToRemove.forEach((attr) => {
        element.removeAttribute(attr);
      });
      const allElements = element.querySelectorAll("*");
      allElements.forEach((el) => {
        attrsToRemove.forEach((attr) => {
          el.removeAttribute(attr);
        });
        const ngAttrs = Array.from(el.attributes).filter((attr) => attr.name.startsWith("_ng") || attr.name.startsWith("ng-"));
        ngAttrs.forEach((attr) => el.removeAttribute(attr.name));
      });
      const hiddenElements = element.querySelectorAll('[style*="display: none"], [hidden], .cdk-visually-hidden');
      hiddenElements.forEach((el) => el.remove());
    }
  };

  // src/content/adapters/chatgpt.ts
  var ChatGPTAdapter = class extends BaseAdapter {
    constructor() {
      super(...arguments);
      this.name = "ChatGPT";
    }
    detect() {
      return window.location.hostname.includes("chat.openai.com");
    }
    extractConversations() {
      const conversations = [];
      const seenIds = /* @__PURE__ */ new Set();
      const selectors = [
        '[data-testid*="conversation-turn"]',
        'div[class*="group"]',
        'div[class*="message"]'
      ];
      let messageGroups = null;
      for (const selector of selectors) {
        messageGroups = document.querySelectorAll(selector);
        if (messageGroups.length > 0)
          break;
      }
      if (!messageGroups || messageGroups.length === 0) {
        return conversations;
      }
      messageGroups.forEach((group) => {
        const userSelectors = [
          '[data-message-author-role="user"]',
          'div[class*="user"]',
          "div:has-text"
        ];
        let questionEl = null;
        for (const sel of userSelectors) {
          questionEl = group.querySelector(sel);
          if (questionEl)
            break;
        }
        const assistantSelectors = [
          '[data-message-author-role="assistant"]',
          'div[class*="assistant"]',
          'div[class*="model"]'
        ];
        let answerEl = null;
        for (const sel of assistantSelectors) {
          answerEl = group.querySelector(sel);
          if (answerEl)
            break;
        }
        if (questionEl && answerEl) {
          const question = this.extractText(questionEl).trim();
          const answer = this.extractText(answerEl).trim();
          if (question && answer && question.length > 5 && answer.length > 10) {
            const id = this.generateId(group, question, answer);
            if (seenIds.has(id)) {
              return;
            }
            seenIds.add(id);
            const questionHtml = this.extractHtml(questionEl);
            const answerHtml = this.extractHtml(answerEl);
            conversations.push({
              id,
              timestamp: Date.now(),
              platform: this.name,
              domain: window.location.hostname,
              question,
              answer,
              questionHtml: questionHtml || void 0,
              answerHtml: answerHtml || void 0,
              pageUrl: window.location.href
            });
          }
        }
      });
      return conversations;
    }
  };

  // src/content/adapters/gemini.ts
  var GeminiAdapter = class extends BaseAdapter {
    constructor() {
      super(...arguments);
      this.name = "Gemini";
    }
    detect() {
      return window.location.hostname.includes("gemini.google.com");
    }
    extractConversations() {
      const conversations = [];
      const seenIds = /* @__PURE__ */ new Set();
      const chatHistory = document.getElementById("chat-history");
      if (!chatHistory) {
        return conversations;
      }
      let conversationTitle = void 0;
      const titleElement = document.querySelector('[class*="conversation-title"]');
      if (titleElement) {
        conversationTitle = this.extractText(titleElement).trim();
      }
      const conversationContainers = chatHistory.querySelectorAll('[class*="conversation-container"]');
      if (conversationContainers.length === 0) {
        return conversations;
      }
      conversationContainers.forEach((container) => {
        const userQueryContainer = container.querySelector('[class*="user-query-container"]');
        if (!userQueryContainer) {
          return;
        }
        const responseContainer = container.querySelector('[class*="response-container-content"]');
        if (!responseContainer) {
          return;
        }
        const question = this.extractText(userQueryContainer).trim();
        const answer = this.extractText(responseContainer).trim();
        if (!question || question.length < 5) {
          return;
        }
        if (!answer || answer.length < 20) {
          return;
        }
        const id = this.generateId(container, question, answer);
        if (seenIds.has(id)) {
          return;
        }
        seenIds.add(id);
        const questionHtml = this.extractHtml(userQueryContainer);
        const answerHtml = this.extractHtml(responseContainer);
        conversations.push({
          id,
          timestamp: Date.now(),
          platform: this.name,
          domain: window.location.hostname,
          question,
          answer,
          questionHtml: questionHtml || void 0,
          answerHtml: answerHtml || void 0,
          title: conversationTitle || void 0,
          pageUrl: window.location.href
        });
      });
      return conversations;
    }
  };

  // src/content/adapters/deepseek.ts
  var DeepSeekAdapter = class extends BaseAdapter {
    constructor() {
      super(...arguments);
      this.name = "DeepSeek";
    }
    detect() {
      return window.location.hostname.includes("deepseek.com");
    }
    extractConversations() {
      const conversations = [];
      const seenIds = /* @__PURE__ */ new Set();
      const scrollAreas = document.querySelectorAll(".ds-scroll-area");
      if (scrollAreas.length < 2) {
        return conversations;
      }
      let rightScrollArea = null;
      for (const area of scrollAreas) {
        const hasMessages = area.querySelector(".ds-message");
        if (hasMessages) {
          rightScrollArea = area;
          break;
        }
      }
      if (!rightScrollArea) {
        return conversations;
      }
      let conversationTitle = void 0;
      for (const area of scrollAreas) {
        if (area === rightScrollArea)
          continue;
        const focusRings = area.querySelectorAll(".ds-focus-ring");
        for (const focusRing of focusRings) {
          let nextEl = focusRing.nextElementSibling;
          let checkedCount = 0;
          while (nextEl && checkedCount < 5) {
            checkedCount++;
            const classes = nextEl.className || "";
            if (classes && classes.split(" ").length >= 2) {
              const titleText = this.extractText(nextEl).trim();
              if (titleText && !this.isDateCategory(titleText) && titleText.length > 3) {
                if (this.isValidTitle(titleText)) {
                  conversationTitle = titleText;
                  break;
                }
              }
            }
            nextEl = nextEl.nextElementSibling;
            if (nextEl && nextEl.classList.contains("ds-focus-ring"))
              break;
          }
          if (conversationTitle)
            break;
        }
        if (conversationTitle)
          break;
      }
      if (!conversationTitle) {
        const potentialTitles = document.querySelectorAll('[class*="afa34042"], [class*="e37a04e4"], [class*="e0a1edb7"]');
        for (const titleEl of potentialTitles) {
          let prev = titleEl.previousElementSibling;
          let checkedCount = 0;
          while (prev && prev !== titleEl.parentElement && checkedCount < 3) {
            checkedCount++;
            if (prev.classList.contains("ds-focus-ring")) {
              const titleText = this.extractText(titleEl).trim();
              if (titleText && !this.isDateCategory(titleText) && this.isValidTitle(titleText)) {
                conversationTitle = titleText;
                break;
              }
            }
            prev = prev.previousElementSibling;
          }
          if (conversationTitle)
            break;
        }
      }
      if (!conversationTitle) {
        const pageTitle = document.title;
        if (pageTitle && this.isValidTitle(pageTitle)) {
          conversationTitle = pageTitle;
        }
      }
      const allMessages = rightScrollArea.querySelectorAll(".ds-message");
      if (allMessages.length === 0) {
        return conversations;
      }
      for (let i = 0; i < allMessages.length - 1; i += 2) {
        const questionEl = allMessages[i];
        const answerEl = allMessages[i + 1];
        if (!questionEl || !answerEl)
          continue;
        const questionClasses = questionEl.className || "";
        const answerClasses = answerEl.className || "";
        const isUserMessage = questionClasses.includes("d29f3d7d") && questionClasses.includes("ds-message") && questionClasses.includes("_63c77b1");
        const isAiMessage = answerClasses.includes("_63c77b1") && answerClasses.includes("ds-message") && !answerClasses.includes("d29f3d7d");
        if (!isUserMessage || !isAiMessage) {
          continue;
        }
        const question = this.extractText(questionEl).trim();
        if (!question || question.length < 5) {
          continue;
        }
        const markdownContainer = answerEl.querySelector(".ds-markdown");
        let answer = "";
        let answerHtml = "";
        if (markdownContainer) {
          const paragraphs = markdownContainer.querySelectorAll(".ds-markdown-paragraph");
          if (paragraphs.length > 0) {
            answer = Array.from(paragraphs).map((p) => this.extractText(p)).filter((t) => t.trim()).join("\n\n").trim();
            answerHtml = Array.from(paragraphs).map((p) => this.extractHtml(p)).filter((h) => h.trim()).join("\n\n").trim();
          } else {
            answer = this.extractText(markdownContainer).trim();
            answerHtml = this.extractHtml(markdownContainer).trim();
          }
        } else {
          answer = this.extractText(answerEl).trim();
          answerHtml = this.extractHtml(answerEl).trim();
        }
        if (!answer || answer.length < 20) {
          continue;
        }
        const id = this.generateId(questionEl, question, answer);
        if (seenIds.has(id)) {
          continue;
        }
        seenIds.add(id);
        const questionHtml = this.extractHtml(questionEl).trim();
        conversations.push({
          id,
          timestamp: Date.now(),
          platform: this.name,
          domain: window.location.hostname,
          question,
          answer,
          questionHtml: questionHtml || void 0,
          answerHtml: answerHtml || void 0,
          title: conversationTitle || void 0,
          pageUrl: window.location.href
        });
      }
      return conversations;
    }
    /**
     * 判断是否是日期分类文本（如"昨天"、"7天内"等）
     */
    isDateCategory(text) {
      const dateKeywords = [
        "\u6628\u5929",
        "\u4ECA\u5929",
        "\u660E\u5929",
        "7\u5929\u5185",
        "30\u5929\u5185",
        "7\u5929",
        "30\u5929",
        "\u4E00\u5468\u5185",
        "\u4E00\u4E2A\u6708\u5185",
        "\u4E00\u5E74\u5185",
        "yesterday",
        "today",
        "tomorrow",
        "7 days",
        "30 days",
        "week",
        "month",
        "year"
      ];
      const lowerText = text.toLowerCase();
      return dateKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
    }
    /**
     * 验证是否是有效的标题
     */
    isValidTitle(text) {
      if (text.length < 3)
        return false;
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(text))
        return false;
      if (/^[a-f0-9]{16,}$/i.test(text))
        return false;
      if (!/[\u4e00-\u9fa5a-zA-Z]/.test(text))
        return false;
      return true;
    }
  };

  // src/content/adapters/index.ts
  function getPlatformAdapters() {
    return [
      new ChatGPTAdapter(),
      new GeminiAdapter(),
      new DeepSeekAdapter()
    ];
  }
  function detectPlatform() {
    const adapters = getPlatformAdapters();
    return adapters.find((adapter) => adapter.detect()) || null;
  }

  // src/content/index.ts
  var ConversationCapture = class {
    constructor() {
      this.observer = null;
      this.platformAdapter = detectPlatform();
      this.capturedIds = /* @__PURE__ */ new Set();
      this.existingIds = /* @__PURE__ */ new Set();
      // 已存在于数据库的ID
      this.debounceTimer = null;
      this.domainConfig = new DomainConfigManager();
      this.initialScanDone = false;
      this.isProcessing = false;
      // 防止并发处理
      this.lastCheckTime = 0;
      // 上次检查时间，用于节流
      this.THROTTLE_INTERVAL = 3e3;
      // 节流间隔：3秒
      this.DEBOUNCE_DELAY = 2e3;
      // 防抖延迟：2秒
      this.visibilityChangeHandler = null;
    }
    async init() {
      const currentDomain = window.location.hostname;
      const isTracked = await this.domainConfig.isDomainTracked(currentDomain);
      if (!isTracked) {
        return;
      }
      if (!this.platformAdapter) {
        return;
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          this.startObserving();
        });
      } else {
        this.startObserving();
      }
    }
    startObserving() {
      this.performInitialScan();
      const observeTarget = this.getObserveTarget();
      this.observer = new MutationObserver((mutations) => {
        if (document.hidden) {
          return;
        }
        if (!this.hasRelevantChanges(mutations)) {
          return;
        }
        const now = Date.now();
        if (now - this.lastCheckTime < this.THROTTLE_INTERVAL) {
          return;
        }
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
          this.detectNewConversations();
          this.lastCheckTime = Date.now();
        }, this.DEBOUNCE_DELAY);
      });
      this.observer.observe(observeTarget, {
        childList: true,
        subtree: true,
        characterData: false
        // 关闭字符数据监听，减少回调
      });
      this.visibilityChangeHandler = () => {
        if (document.hidden) {
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
          }
        }
      };
      document.addEventListener("visibilitychange", this.visibilityChangeHandler);
    }
    /**
     * 获取观察目标元素（尝试找到对话容器，减少观察范围）
     */
    getObserveTarget() {
      if (!this.platformAdapter) {
        return document.body;
      }
      const geminiContainer = document.getElementById("chat-history");
      if (geminiContainer) {
        return geminiContainer;
      }
      const deepseekContainers = document.querySelectorAll(".ds-scroll-area");
      for (const container of deepseekContainers) {
        if (container.querySelector(".ds-message")) {
          return container;
        }
      }
      const chatgptContainer = document.querySelector('[data-testid*="conversation"], main, [role="main"]');
      if (chatgptContainer) {
        return chatgptContainer;
      }
      return document.body;
    }
    /**
     * 检查mutations是否包含与对话相关的变化
     */
    hasRelevantChanges(mutations) {
      if (!this.platformAdapter)
        return false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              if (this.isConversationElement(element)) {
                return true;
              }
            }
          }
        }
        if (mutation.type === "childList" && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const element = mutation.target;
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
    isConversationElement(element) {
      const className = element.className || "";
      const id = element.id || "";
      const tagName = element.tagName.toLowerCase();
      const platformHints = [
        // Gemini
        "conversation-container",
        "user-query-container",
        "response-container-content",
        "chat-history",
        // ChatGPT
        "message",
        "conversation",
        // DeepSeek
        "ds-message",
        "ds-markdown",
        "ds-markdown-paragraph"
      ];
      const text = `${className} ${id}`.toLowerCase();
      if (platformHints.some((hint) => text.includes(hint))) {
        return true;
      }
      let depth = 0;
      const maxDepth = 2;
      const checkChildren = (el, currentDepth) => {
        if (currentDepth > maxDepth)
          return false;
        for (const child of Array.from(el.children)) {
          const childClass = child.className || "";
          const childId = child.id || "";
          const childText = `${childClass} ${childId}`.toLowerCase();
          if (platformHints.some((hint) => childText.includes(hint))) {
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
    async performInitialScan() {
      if (!this.platformAdapter)
        return;
      if (!chrome.runtime || !chrome.runtime.id) {
        console.warn("[AI KB] Extension context invalidated. Please reload the page.");
        this.stopObserving();
        return;
      }
      try {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        const conversations = this.platformAdapter.extractConversations();
        if (conversations.length === 0) {
          this.initialScanDone = true;
          return;
        }
        const ids = conversations.map((c) => c.id);
        const existingIds = await this.checkExistingIds(ids);
        existingIds.forEach((id) => {
          this.existingIds.add(id);
          this.capturedIds.add(id);
        });
        for (const conv of conversations) {
          if (!this.capturedIds.has(conv.id) && !this.existingIds.has(conv.id)) {
            this.capturedIds.add(conv.id);
            await this.sendToBackground(conv);
          }
        }
        this.initialScanDone = true;
      } catch (error) {
        if (error && error.message && error.message.includes("Extension context invalidated")) {
          this.stopObserving();
        }
      }
    }
    /**
     * 检查哪些对话ID已存在于数据库
     */
    async checkExistingIds(ids) {
      return new Promise((resolve) => {
        if (!chrome.runtime || !chrome.runtime.id) {
          resolve([]);
          return;
        }
        chrome.runtime.sendMessage(
          { type: "CHECK_CONVERSATION_IDS", ids },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve([]);
              return;
            }
            resolve((response == null ? void 0 : response.existingIds) || []);
          }
        );
      });
    }
    /**
     * 检测新对话（用于DOM变化监听）
     */
    detectNewConversations() {
      if (!this.platformAdapter || !this.initialScanDone)
        return;
      if (this.isProcessing) {
        return;
      }
      if (document.hidden) {
        return;
      }
      if (!chrome.runtime || !chrome.runtime.id) {
        console.warn("[AI KB] Extension context invalidated. Please reload the page.");
        this.stopObserving();
        return;
      }
      this.isProcessing = true;
      try {
        const conversations = this.platformAdapter.extractConversations();
        if (conversations.length === 0) {
          this.isProcessing = false;
          return;
        }
        const newConversations = conversations.filter((conv) => {
          return !this.capturedIds.has(conv.id) && !this.existingIds.has(conv.id);
        });
        if (newConversations.length === 0) {
          this.isProcessing = false;
          return;
        }
        this.sendNewConversations(newConversations).finally(() => {
          this.isProcessing = false;
        });
      } catch (error) {
        this.isProcessing = false;
        if (error && error.message && error.message.includes("Extension context invalidated")) {
          this.stopObserving();
        }
      }
    }
    /**
     * 批量发送新对话（异步处理，不阻塞）
     */
    async sendNewConversations(conversations) {
      for (const conv of conversations) {
        this.capturedIds.add(conv.id);
        await this.sendToBackground(conv);
        if (conversations.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }
    async sendToBackground(conv) {
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
            type: "NEW_CONVERSATION",
            data: {
              ...conv,
              domain: window.location.hostname,
              pageUrl: window.location.href
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              if (chrome.runtime.lastError.message.includes("Extension context invalidated")) {
                this.stopObserving();
              }
              resolve();
              return;
            }
            if (response && response.success) {
              if (response.duplicate) {
                this.existingIds.add(conv.id);
              }
              if (response.storageWarning) {
              }
            }
            resolve();
          });
        } catch (err) {
          if (err.message && err.message.includes("Extension context invalidated")) {
            this.stopObserving();
          }
          resolve();
        }
      });
    }
    stopObserving() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      if (this.visibilityChangeHandler) {
        document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
        this.visibilityChangeHandler = null;
      }
    }
  };
  var capture = new ConversationCapture();
  capture.init();
})();
