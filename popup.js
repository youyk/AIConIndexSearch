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

  // src/shared/utils.ts
  function escapeHtml(text) {
    if (typeof text !== "string") {
      return "";
    }
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString("zh-CN");
  }
  function truncate(text, length) {
    return text.length > length ? text.substring(0, length) + "..." : text;
  }

  // src/popup/index.ts
  var searchInput = document.getElementById("search-input");
  var filterToggleBtn = document.getElementById("filter-toggle-btn");
  var filtersPanel = document.getElementById("filters-panel");
  var platformFilter = document.getElementById("platform-filter");
  var startDateFilter = document.getElementById("start-date");
  var endDateFilter = document.getElementById("end-date");
  var tagsFilter = document.getElementById("tags-filter");
  var favoriteOnlyCheckbox = document.getElementById("favorite-only");
  var resultsList = document.getElementById("results-list");
  var resultsCount = document.getElementById("results-count");
  var noResults = document.getElementById("no-results");
  var detailView = document.getElementById("detail-view");
  var detailContent = document.getElementById("detail-content");
  var conversationDetail = document.getElementById("conversation-detail");
  var batchActions = document.getElementById("batch-actions");
  var batchExportBtn = document.getElementById("batch-export-btn");
  var batchDeleteBtn = document.getElementById("batch-delete-btn");
  var selectAllCheckbox = document.getElementById("select-all-checkbox");
  var backBtn = document.getElementById("back-btn");
  var settingsView = document.getElementById("settings-view");
  var settingsBtn = document.getElementById("settings-btn");
  var settingsBackBtn = document.getElementById("settings-back-btn");
  var exportBtn = document.getElementById("export-btn");
  var exportAllBtn = document.getElementById("export-all-btn");
  var clearDataBtn = document.getElementById("clear-data-btn");
  var exportDialog = document.getElementById("export-dialog");
  var exportDialogClose = document.getElementById("export-dialog-close");
  var exportDialogDescription = document.getElementById("export-dialog-description");
  var domainsList = document.getElementById("domains-list");
  var newDomainInput = document.getElementById("new-domain-input");
  var addDomainBtn = document.getElementById("add-domain-btn");
  var domainConfig = new DomainConfigManager();
  var currentConversation = null;
  var searchDebounceTimer = null;
  var currentSearchResultIds = [];
  var currentSearchResults = [];
  var selectedConversationIds = /* @__PURE__ */ new Set();
  async function init() {
    await loadPlatforms();
    await loadTags();
    await loadDomains();
    setupEventListeners();
  }
  function setupEventListeners() {
    searchInput.addEventListener("input", handleSearch);
    filterToggleBtn.addEventListener("click", () => {
      filtersPanel.style.display = filtersPanel.style.display === "none" ? "block" : "none";
    });
    platformFilter.addEventListener("change", handleSearch);
    startDateFilter.addEventListener("change", handleSearch);
    endDateFilter.addEventListener("change", handleSearch);
    tagsFilter.addEventListener("change", handleSearch);
    favoriteOnlyCheckbox.addEventListener("change", handleSearch);
    backBtn.addEventListener("click", showMainView);
    settingsBtn.addEventListener("click", showSettingsView);
    settingsBackBtn.addEventListener("click", showMainView);
    exportBtn.addEventListener("click", () => showExportDialog("search"));
    exportAllBtn.addEventListener("click", () => showExportDialog("all"));
    exportDialogClose.addEventListener("click", closeExportDialog);
    exportDialog.addEventListener("click", (e) => {
      const target = e.target;
      const formatOption = target.closest(".format-option");
      if (formatOption) {
        const format = formatOption.dataset.format;
        if (format) {
          handleExportFormatSelection(format);
        }
      }
    });
    exportDialog.addEventListener("click", (e) => {
      if (e.target === exportDialog) {
        closeExportDialog();
      }
    });
    detailContent.addEventListener("click", (e) => {
      const target = e.target;
      const btn = target.closest("button");
      if (!btn)
        return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "toggle-favorite" && id) {
        toggleFavorite(id);
      } else if (action === "delete" && id) {
        deleteConversation(id);
      } else if (action === "export" && id) {
        showExportDialog("selected", [id]);
      }
    });
    domainsList.addEventListener("click", (e) => {
      const target = e.target;
      const btn = target.closest("button");
      if (!btn)
        return;
      const action = btn.dataset.action;
      const domain = btn.dataset.domain;
      if (action === "remove" && domain) {
        removeDomain(domain);
      }
    });
    domainsList.addEventListener("change", (e) => {
      const target = e.target;
      if (target.type === "checkbox" && target.dataset.domain) {
        toggleDomain(target.dataset.domain, target.checked);
      }
    });
    batchExportBtn.addEventListener("click", handleBatchExport);
    batchDeleteBtn.addEventListener("click", handleBatchDelete);
    selectAllCheckbox.addEventListener("change", handleSelectAll);
    resultsList.addEventListener("change", (e) => {
      const target = e.target;
      if (target.type === "checkbox" && target.classList.contains("conversation-checkbox")) {
        updateBatchActions();
      }
    });
    resultsList.addEventListener("click", (e) => {
      const target = e.target;
      const item = target.closest(".conversation-item");
      if (!item)
        return;
      if (target.type === "checkbox" || target.closest('input[type="checkbox"]')) {
        return;
      }
      const id = item.dataset.id;
      if (id) {
        selectConversation(id);
      }
    });
    addDomainBtn.addEventListener("click", addDomain);
    clearDataBtn.addEventListener("click", clearAllData);
  }
  async function handleSearch() {
    const query = searchInput.value.trim();
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = window.setTimeout(async () => {
      const options = {};
      if (platformFilter.value) {
        options.platform = platformFilter.value;
      }
      if (startDateFilter.value) {
        options.startDate = new Date(startDateFilter.value).getTime();
      }
      if (endDateFilter.value) {
        options.endDate = new Date(endDateFilter.value).getTime() + 864e5;
      }
      if (tagsFilter.selectedOptions.length > 0) {
        options.tags = Array.from(tagsFilter.selectedOptions).map((opt) => opt.value);
      }
      if (favoriteOnlyCheckbox.checked) {
        options.favoriteOnly = true;
      }
      try {
        const response = await chrome.runtime.sendMessage({
          type: "SEARCH_CONVERSATIONS",
          query,
          options
        });
        if (response && response.results) {
          displayResults(response.results);
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }, 300);
  }
  function groupByTitle(results) {
    const groups = {};
    results.forEach((result) => {
      const conv = result.conversation;
      let title = "\u672A\u5206\u7C7B\u5BF9\u8BDD";
      if (conv.title && conv.title.trim().length > 0) {
        title = conv.title.trim();
      } else if (conv.pageUrl) {
        try {
          const url = new URL(conv.pageUrl);
          const pathParts = url.pathname.split("/").filter((p) => p);
          if (pathParts.length > 0) {
            const urlTitle = decodeURIComponent(pathParts[pathParts.length - 1]);
            if (urlTitle.length > 3 && !/^[a-f0-9]{16,}$/i.test(urlTitle)) {
              title = urlTitle;
            }
          }
        } catch (e) {
        }
      }
      if (title === "\u672A\u5206\u7C7B\u5BF9\u8BDD" || title.length < 3) {
        title = truncate(conv.question, 30) || "\u672A\u5206\u7C7B\u5BF9\u8BDD";
      }
      if (!groups[title]) {
        groups[title] = [];
      }
      groups[title].push(result);
    });
    return groups;
  }
  function createConversationListItem(result, isFirst) {
    const { conversation, highlights } = result;
    const item = document.createElement("div");
    item.className = "conversation-item";
    item.dataset.id = conversation.id;
    if (isFirst) {
      item.classList.add("selected");
    }
    const questionPreview = truncate(conversation.question, 50);
    const favoriteBadge = conversation.favorite ? '<span class="favorite-badge">\u2B50</span>' : "";
    item.innerHTML = `
    <input type="checkbox" class="conversation-checkbox" data-id="${conversation.id}">
    <div class="item-content">
      <div class="item-header">
        <span class="item-key">${highlightText(questionPreview, highlights.question)}</span>
        ${favoriteBadge}
      </div>
      <div class="item-meta">
        <span class="platform-badge">${escapeHtml(conversation.platform)}</span>
        <span class="timestamp">${formatDate(conversation.timestamp)}</span>
      </div>
    </div>
  `;
    return item;
  }
  function displayResults(results) {
    resultsList.innerHTML = "";
    selectedConversationIds.clear();
    currentSearchResults = results;
    currentSearchResultIds = results.map((r) => r.conversation.id);
    if (results.length === 0) {
      noResults.style.display = "block";
      resultsCount.textContent = "";
      batchActions.style.display = "none";
      conversationDetail.innerHTML = '<div class="detail-placeholder"><p>\u8BF7\u4ECE\u5DE6\u4FA7\u9009\u62E9\u4E00\u4E2A\u5BF9\u8BDD\u67E5\u770B\u8BE6\u60C5</p></div>';
      return;
    }
    noResults.style.display = "none";
    resultsCount.textContent = `\u627E\u5230 ${results.length} \u6761\u7ED3\u679C`;
    batchActions.style.display = "flex";
    const groupedResults = groupByTitle(results);
    Object.entries(groupedResults).forEach(([title, items]) => {
      const groupDiv = document.createElement("div");
      groupDiv.className = "conversation-group";
      const titleDiv = document.createElement("div");
      titleDiv.className = "group-title";
      titleDiv.textContent = title;
      groupDiv.appendChild(titleDiv);
      items.forEach((result, index) => {
        const item = createConversationListItem(result, index === 0 && Object.keys(groupedResults).length === 1);
        groupDiv.appendChild(item);
      });
      resultsList.appendChild(groupDiv);
    });
    if (results.length > 0) {
      const firstId = results[0].conversation.id;
      selectConversation(firstId);
    }
  }
  function highlightText(text, highlights) {
    let highlighted = escapeHtml(text);
    highlights.forEach((term) => {
      const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
      highlighted = highlighted.replace(regex, "<mark>$1</mark>");
    });
    return highlighted;
  }
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  async function selectConversation(id) {
    document.querySelectorAll(".conversation-item").forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.id === id) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });
    const result = currentSearchResults.find((r) => r.conversation.id === id);
    if (!result)
      return;
    await showConversationDetail(result.conversation, result.highlights);
  }
  async function showConversationDetail(conv, highlights) {
    currentConversation = conv;
    const tagsHtml = conv.tags && conv.tags.length > 0 ? `<div class="tags">${conv.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : "";
    const notesHtml = conv.notes ? `<div class="detail-section">
        <span class="label">\u7B14\u8BB0\uFF1A</span>
        <div class="text">${escapeHtml(conv.notes)}</div>
      </div>` : "";
    const questionContent = conv.questionHtml ? sanitizeHtmlForDisplay(conv.questionHtml) : escapeHtml(conv.question);
    const answerContent = conv.answerHtml ? sanitizeHtmlForDisplay(conv.answerHtml) : escapeHtml(conv.answer);
    conversationDetail.innerHTML = `
    <div class="detail-header-info">
      <div class="detail-title">
        <span class="platform-badge">${escapeHtml(conv.platform)}</span>
        <span class="detail-date">${formatDate(conv.timestamp)}</span>
        ${conv.favorite ? '<span class="favorite-badge">\u2B50</span>' : ""}
      </div>
    </div>
    <div class="detail-sections">
      <div class="detail-section">
        <div class="section-label">\u95EE\u9898</div>
        <div class="section-content ${conv.questionHtml ? "formatted-content" : ""}">${questionContent}</div>
      </div>
      <div class="detail-section">
        <div class="section-label">\u56DE\u7B54</div>
        <div class="section-content ${conv.answerHtml ? "formatted-content" : ""}">${answerContent}</div>
      </div>
      ${tagsHtml ? `<div class="detail-section"><div class="section-label">\u6807\u7B7E</div><div class="section-content">${tagsHtml}</div></div>` : ""}
      ${notesHtml ? `<div class="detail-section"><div class="section-label">\u7B14\u8BB0</div><div class="section-content">${notesHtml}</div></div>` : ""}
    </div>
    <div class="detail-actions">
      <button class="action-btn" data-action="toggle-favorite" data-id="${conv.id}">
        ${conv.favorite ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF"}
      </button>
      <button class="action-btn" data-action="delete" data-id="${conv.id}">\u5220\u9664</button>
      <button class="action-btn" data-action="export" data-id="${conv.id}">\u5BFC\u51FA</button>
    </div>
  `;
    conversationDetail.addEventListener("click", (e) => {
      const target = e.target;
      const btn = target.closest("button");
      if (!btn)
        return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "toggle-favorite" && id) {
        toggleFavorite(id);
      } else if (action === "delete" && id) {
        deleteConversation(id);
      } else if (action === "export" && id) {
        showExportDialog("selected", [id]);
      }
    });
  }
  function showMainView() {
    detailView.style.display = "none";
    settingsView.style.display = "none";
    document.querySelector(".results-section").setAttribute("style", "display: block");
  }
  function showSettingsView() {
    document.querySelector(".results-section").setAttribute("style", "display: none");
    detailView.style.display = "none";
    settingsView.style.display = "block";
    loadStatistics();
  }
  async function loadPlatforms() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_PLATFORMS" });
      if (response && response.platforms) {
        platformFilter.innerHTML = '<option value="">\u5168\u90E8</option>';
        response.platforms.forEach((platform) => {
          const option = document.createElement("option");
          option.value = platform;
          option.textContent = platform;
          platformFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Load platforms error:", error);
    }
  }
  async function loadTags() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_TAGS" });
      if (response && response.tags) {
        tagsFilter.innerHTML = "";
        response.tags.forEach((tag) => {
          const option = document.createElement("option");
          option.value = tag;
          option.textContent = tag;
          tagsFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Load tags error:", error);
    }
  }
  async function loadDomains() {
    const domains = await domainConfig.getDomains();
    domainsList.innerHTML = "";
    domains.forEach((domain) => {
      const item = document.createElement("div");
      item.className = "domain-item";
      item.innerHTML = `
      <input type="checkbox" ${domain.enabled ? "checked" : ""} 
             data-domain="${escapeHtml(domain.domain)}">
      <span>${escapeHtml(domain.name || domain.domain)}</span>
      <span style="color: #888; font-size: 12px;">${escapeHtml(domain.domain)}</span>
      <button class="action-btn" data-action="remove" data-domain="${escapeHtml(domain.domain)}" style="margin-left: auto;">\u5220\u9664</button>
    `;
      domainsList.appendChild(item);
    });
  }
  async function addDomain() {
    const domain = newDomainInput.value.trim();
    if (domain) {
      await domainConfig.addDomain(domain);
      newDomainInput.value = "";
      await loadDomains();
    }
  }
  async function toggleDomain(domain, enabled) {
    await domainConfig.updateDomain(domain, { enabled });
  }
  async function removeDomain(domain) {
    if (confirm("\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u4E2A\u57DF\u540D\u5417\uFF1F")) {
      await domainConfig.removeDomain(domain);
      await loadDomains();
    }
  }
  function updateBatchActions() {
    const checkedBoxes = resultsList.querySelectorAll(".conversation-checkbox:checked");
    selectedConversationIds.clear();
    checkedBoxes.forEach((cb) => {
      selectedConversationIds.add(cb.dataset.id);
    });
    const count = selectedConversationIds.size;
    if (count > 0) {
      batchExportBtn.textContent = `\u5BFC\u51FA\u9009\u4E2D (${count})`;
      batchDeleteBtn.textContent = `\u5220\u9664\u9009\u4E2D (${count})`;
      batchActions.style.display = "flex";
    } else {
      batchActions.style.display = "none";
    }
    const allBoxes = resultsList.querySelectorAll(".conversation-checkbox");
    selectAllCheckbox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
  }
  function handleSelectAll() {
    const checkboxes = resultsList.querySelectorAll(".conversation-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = selectAllCheckbox.checked;
    });
    updateBatchActions();
  }
  async function handleBatchExport() {
    const ids = Array.from(selectedConversationIds);
    if (ids.length === 0) {
      alert("\u8BF7\u5148\u9009\u62E9\u8981\u5BFC\u51FA\u7684\u5BF9\u8BDD");
      return;
    }
    showExportDialog("selected", ids);
  }
  async function handleBatchDelete() {
    const ids = Array.from(selectedConversationIds);
    if (ids.length === 0) {
      alert("\u8BF7\u5148\u9009\u62E9\u8981\u5220\u9664\u7684\u5BF9\u8BDD");
      return;
    }
    if (!confirm(`\u786E\u5B9A\u8981\u5220\u9664\u9009\u4E2D\u7684 ${ids.length} \u6761\u5BF9\u8BDD\u5417\uFF1F`)) {
      return;
    }
    try {
      await Promise.all(ids.map((id) => chrome.runtime.sendMessage({ type: "DELETE_CONVERSATION", id })));
      selectedConversationIds.clear();
      await handleSearch();
    } catch (error) {
      console.error("Batch delete error:", error);
      alert("\u5220\u9664\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    }
  }
  async function toggleFavorite(id) {
    const conv = currentConversation;
    if (!conv)
      return;
    await chrome.runtime.sendMessage({
      type: "UPDATE_CONVERSATION",
      id,
      updates: { favorite: !conv.favorite }
    });
    await handleSearch();
  }
  async function deleteConversation(id) {
    if (confirm("\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u6761\u5BF9\u8BDD\u5417\uFF1F")) {
      await chrome.runtime.sendMessage({ type: "DELETE_CONVERSATION", id });
      await handleSearch();
    }
  }
  var pendingExportType = "all";
  var pendingExportIds = void 0;
  function showExportDialog(type, ids) {
    pendingExportType = type;
    pendingExportIds = ids;
    let description = "\u8BF7\u9009\u62E9\u5BFC\u51FA\u683C\u5F0F\uFF1A";
    if (type === "all") {
      description = "\u5BFC\u51FA\u6240\u6709\u5BF9\u8BDD\u6570\u636E\uFF0C\u8BF7\u9009\u62E9\u683C\u5F0F\uFF1A";
    } else if (type === "selected") {
      description = `\u5BFC\u51FA\u9009\u4E2D\u7684 ${(ids == null ? void 0 : ids.length) || 0} \u6761\u5BF9\u8BDD\uFF0C\u8BF7\u9009\u62E9\u683C\u5F0F\uFF1A`;
    } else if (type === "search") {
      description = "\u5BFC\u51FA\u5F53\u524D\u641C\u7D22\u7ED3\u679C\uFF0C\u8BF7\u9009\u62E9\u683C\u5F0F\uFF1A";
    }
    exportDialogDescription.textContent = description;
    exportDialog.style.display = "flex";
  }
  function closeExportDialog() {
    exportDialog.style.display = "none";
    pendingExportType = "all";
    pendingExportIds = void 0;
  }
  async function handleExportFormatSelection(format) {
    const exportType = pendingExportType;
    const exportIds = pendingExportIds ? [...pendingExportIds] : void 0;
    closeExportDialog();
    let type = "all";
    let ids = void 0;
    if (exportType === "selected" && exportIds && exportIds.length > 0) {
      type = "selected";
      ids = exportIds;
    } else if (exportType === "search") {
      if (currentSearchResultIds.length > 0) {
        type = "selected";
        ids = [...currentSearchResultIds];
      } else {
        alert("\u5F53\u524D\u6CA1\u6709\u641C\u7D22\u7ED3\u679C\uFF0C\u8BF7\u5148\u8FDB\u884C\u641C\u7D22");
        return;
      }
    }
    await exportData(type, ids, format);
  }
  async function exportData(type, ids, format) {
    if (!format) {
      if (type === "selected" && ids) {
        showExportDialog("selected", ids);
      } else {
        showExportDialog("all");
      }
      return;
    }
    try {
      if (type === "selected" && (!ids || ids.length === 0)) {
        alert("\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u5BF9\u8BDD");
        return;
      }
      if (format === "pdf") {
        await exportToPDF(type, ids);
        return;
      }
      const message = {
        type: "EXPORT_CONVERSATIONS",
        format
      };
      if (type === "selected" && ids && ids.length > 0) {
        message.conversationIds = ids;
      }
      const response = await chrome.runtime.sendMessage(message);
      if (response && response.content) {
        const extensions = { json: "json", markdown: "md", html: "html", csv: "csv" };
        const mimeTypes = { json: "application/json", markdown: "text/markdown", html: "text/html", csv: "text/csv" };
        const count = type === "selected" && ids ? ids.length : "all";
        const filename = `ai-conversations-${count}-${Date.now()}.${extensions[format]}`;
        downloadFile(response.content, filename, mimeTypes[format]);
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    }
  }
  async function exportToPDF(type, ids) {
    var _a, _b;
    try {
      const html2pdf = window.html2pdf;
      if (!html2pdf) {
        alert("PDF\u5BFC\u51FA\u529F\u80FD\u672A\u6B63\u786E\u52A0\u8F7D\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6");
        return;
      }
      let conversations;
      if (type === "selected" && ids && ids.length > 0) {
        const responses = await Promise.all(
          ids.map((id) => chrome.runtime.sendMessage({ type: "GET_CONVERSATION", id }))
        );
        conversations = responses.map((r) => r.conversation).filter((c) => c !== null);
      } else {
        const response = await chrome.runtime.sendMessage({ type: "GET_ALL_CONVERSATIONS" });
        conversations = (response == null ? void 0 : response.conversations) || [];
      }
      if (conversations.length === 0) {
        alert("\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u5BF9\u8BDD");
        return;
      }
      const htmlContent = generatePDFHTML(conversations);
      const iframe = document.createElement("iframe");
      iframe.id = "pdf-export-iframe";
      iframe.style.position = "fixed";
      iframe.style.top = "0";
      iframe.style.left = "0";
      iframe.style.width = "210mm";
      iframe.style.height = "297mm";
      iframe.style.border = "none";
      iframe.style.zIndex = "999999";
      iframe.style.visibility = "hidden";
      iframe.style.opacity = "0";
      document.body.appendChild(iframe);
      await new Promise((resolve) => {
        iframe.onload = resolve;
        iframe.src = "about:blank";
      });
      const iframeDoc = iframe.contentDocument || ((_a = iframe.contentWindow) == null ? void 0 : _a.document);
      if (!iframeDoc) {
        alert("\u65E0\u6CD5\u521B\u5EFAPDF\u5BFC\u51FA\u5BB9\u5668");
        document.body.removeChild(iframe);
        return;
      }
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      const iframeBody = iframeDoc.body;
      if (!iframeBody) {
        alert("iframe\u5185\u5BB9\u52A0\u8F7D\u5931\u8D25");
        document.body.removeChild(iframe);
        return;
      }
      const hasContent = iframeBody.textContent && iframeBody.textContent.trim().length > 0;
      const childCount = iframeBody.children.length;
      if (!hasContent || childCount === 0) {
        alert("PDF\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u8BF7\u68C0\u67E5\u5BF9\u8BDD\u6570\u636E\u3002\u5BF9\u8BDD\u6570\u91CF\uFF1A" + conversations.length + "\n\u6587\u672C\u957F\u5EA6\uFF1A" + (((_b = iframeBody.textContent) == null ? void 0 : _b.length) || 0));
        document.body.removeChild(iframe);
        return;
      }
      iframe.style.visibility = "visible";
      iframe.style.opacity = "1";
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `ai-conversations-${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: true,
          letterRendering: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          windowWidth: iframeBody.scrollWidth || 794,
          // A4 width in pixels at 96dpi
          windowHeight: iframeBody.scrollHeight || 1123,
          // A4 height in pixels
          width: iframeBody.scrollWidth || 794,
          height: iframeBody.scrollHeight || 1123
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
          compress: true
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      };
      try {
        const pdfPromise = html2pdf().set(opt).from(iframeBody).save();
        await pdfPromise;
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        alert(`\u6210\u529F\u5BFC\u51FA ${conversations.length} \u6761\u5BF9\u8BDD\u4E3APDF`);
      } catch (pdfError) {
        alert("PDF\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        alert("PDF\u5BFC\u51FA\u5931\u8D25\uFF1A" + (pdfError instanceof Error ? pdfError.message : "\u672A\u77E5\u9519\u8BEF") + "\n\u8BF7\u67E5\u770B\u63A7\u5236\u53F0\u83B7\u53D6\u8BE6\u7EC6\u4FE1\u606F");
        throw pdfError;
      }
    } catch (error) {
      console.error("PDF export error:", error);
      alert("PDF\u5BFC\u51FA\u5931\u8D25\uFF1A" + (error instanceof Error ? error.message : "\u672A\u77E5\u9519\u8BEF"));
    }
  }
  function generatePDFHTML(conversations) {
    const date = (/* @__PURE__ */ new Date()).toLocaleString("zh-CN");
    const total = conversations.length;
    const testContent = `
    <div style="background: yellow; padding: 20px; margin: 20px; border: 3px solid red;">
      <h1 style="color: red; font-size: 24px;">\u{1F9EA} PDF\u751F\u6210\u6D4B\u8BD5\u5185\u5BB9 \u{1F9EA}</h1>
      <p style="font-size: 18px; color: blue;">\u5982\u679C\u60A8\u80FD\u770B\u5230\u8FD9\u6BB5\u6587\u5B57\uFF0C\u8BF4\u660EPDF\u751F\u6210\u5DE5\u5177\u6B63\u5E38\u5DE5\u4F5C\uFF01</p>
      <p style="font-size: 16px;">\u5F53\u524D\u65F6\u95F4\uFF1A${date}</p>
      <p style="font-size: 16px;">\u5BF9\u8BDD\u6570\u91CF\uFF1A${total}</p>
      <p style="font-size: 14px; color: green;">\u8FD9\u662F\u4E00\u6BB5\u6D4B\u8BD5\u6587\u5B57\uFF0C\u7528\u4E8E\u9A8C\u8BC1html2pdf.js\u662F\u5426\u80FD\u6B63\u786E\u751F\u6210PDF\u6587\u4EF6\u3002</p>
    </div>
  `;
    const conversationsHTML = conversations.map((conv, index) => {
      const dateStr = formatDate(conv.timestamp);
      const tags = conv.tags && conv.tags.length > 0 ? `<div class="tags">${conv.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : "";
      const notes = conv.notes ? `<div class="notes"><strong>\u7B14\u8BB0\uFF1A</strong>${escapeHtml(conv.notes)}</div>` : "";
      const favorite = conv.favorite ? '<span class="favorite">\u2B50</span>' : "";
      let questionContent;
      let answerContent;
      if (conv.questionHtml) {
        questionContent = sanitizeHtmlForDisplay(conv.questionHtml);
      } else {
        if (/(\*\*|__|`|\[.*\]\(.*\)|^#{1,6}\s)/m.test(conv.question)) {
          questionContent = sanitizeHtmlForDisplay(conv.question);
        } else {
          questionContent = escapeHtml(conv.question);
        }
      }
      if (conv.answerHtml) {
        answerContent = sanitizeHtmlForDisplay(conv.answerHtml);
      } else {
        if (/(\*\*|__|`|\[.*\]\(.*\)|^#{1,6}\s)/m.test(conv.answer)) {
          answerContent = sanitizeHtmlForDisplay(conv.answer);
        } else {
          answerContent = escapeHtml(conv.answer);
        }
      }
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
            <div class="text ${conv.questionHtml ? "formatted-content" : ""}">${questionContent}</div>
          </div>
          <div class="answer">
            <div class="label">\u56DE\u7B54\uFF1A</div>
            <div class="text ${conv.answerHtml ? "formatted-content" : ""}">${answerContent}</div>
          </div>
          ${tags}
          ${notes}
        </div>
      </div>
    `;
    }).join("");
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI\u5BF9\u8BDD\u77E5\u8BC6\u5E93\u5BFC\u51FA</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'PingFang SC', 'Microsoft YaHei', sans-serif;
          line-height: 1.6;
          color: #333;
          background: white;
          padding: 20px;
          font-size: 14px;
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
          page-break-inside: avoid;
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
          font-size: 14px;
        }
        
        .text.formatted-content {
          white-space: normal;
        }
        
        .text.formatted-content h1,
        .text.formatted-content h2,
        .text.formatted-content h3,
        .text.formatted-content h4 {
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
      </style>
    </head>
    <body>
      <div class="header">
        <h1>AI\u5BF9\u8BDD\u77E5\u8BC6\u5E93\u5BFC\u51FA</h1>
        <div class="meta">
          \u5BFC\u51FA\u65F6\u95F4\uFF1A${escapeHtml(date)} | \u5171 ${total} \u6761\u5BF9\u8BDD
        </div>
      </div>
      <div class="conversations-container">
        ${conversationsHTML}
      </div>
    </body>
    </html>
  `;
  }
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  async function loadStatistics() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATISTICS" });
      if (response && response.statistics) {
        const stats = response.statistics;
        const storageLocation = response.storageLocation || "IndexedDB: ai-conversation-kb";
        const storageLimit = response.storageLimit;
        const totalCountEl = document.getElementById("stat-total-count");
        const totalSizeEl = document.getElementById("stat-total-size");
        const storageLocationEl = document.getElementById("stat-storage-location");
        const oldestDateEl = document.getElementById("stat-oldest-date");
        const newestDateEl = document.getElementById("stat-newest-date");
        const platformsListEl = document.getElementById("platform-stats-list");
        const storageWarningEl = document.getElementById("storage-warning");
        if (totalCountEl) {
          totalCountEl.textContent = stats.totalCount.toString();
        }
        if (totalSizeEl && storageLimit) {
          const usagePercent = (storageLimit.usagePercent * 100).toFixed(1);
          const formatBytes = (bytes) => {
            if (bytes === 0)
              return "0 B";
            const k = 1024;
            const sizes = ["B", "KB", "MB", "GB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
          };
          const maxSizeFormatted = formatBytes(storageLimit.maxSize);
          totalSizeEl.textContent = `${stats.sizeFormatted} / ${maxSizeFormatted} (${usagePercent}%)`;
          if (storageLimit.usagePercent >= 0.95) {
            totalSizeEl.style.color = "#d32f2f";
          } else if (storageLimit.usagePercent >= 0.8) {
            totalSizeEl.style.color = "#f57c00";
          } else {
            totalSizeEl.style.color = "";
          }
        } else if (totalSizeEl) {
          totalSizeEl.textContent = stats.sizeFormatted;
        }
        if (storageLocationEl) {
          storageLocationEl.textContent = storageLocation;
        }
        if (oldestDateEl) {
          oldestDateEl.textContent = stats.oldestDate ? formatDate(stats.oldestDate) : "\u65E0";
        }
        if (newestDateEl) {
          newestDateEl.textContent = stats.newestDate ? formatDate(stats.newestDate) : "\u65E0";
        }
        if (storageWarningEl && storageLimit) {
          if (storageLimit.warning) {
            storageWarningEl.style.display = "block";
            storageWarningEl.className = storageLimit.usagePercent >= 0.95 ? "storage-warning critical" : storageLimit.usagePercent >= 0.8 ? "storage-warning warning" : "storage-warning";
            storageWarningEl.textContent = storageLimit.warning;
          } else {
            storageWarningEl.style.display = "none";
          }
        }
        if (platformsListEl) {
          platformsListEl.innerHTML = "";
          const platforms = Object.entries(stats.platforms);
          if (platforms.length === 0) {
            platformsListEl.innerHTML = '<div class="platform-stat-item">\u6682\u65E0\u6570\u636E</div>';
          } else {
            platforms.forEach(([platform, count]) => {
              const item = document.createElement("div");
              item.className = "platform-stat-item";
              item.innerHTML = `
              <span class="platform-name">${escapeHtml(platform)}</span>
              <span class="platform-count">${count} \u6761</span>
            `;
              platformsListEl.appendChild(item);
            });
          }
        }
      }
    } catch (error) {
    }
  }
  async function clearAllData() {
    if (confirm("\u786E\u5B9A\u8981\u6E05\u7A7A\u6240\u6709\u6570\u636E\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\uFF01")) {
      try {
        const response = await chrome.runtime.sendMessage({ type: "GET_ALL_CONVERSATIONS" });
        if (response && response.conversations) {
          for (const conv of response.conversations) {
            await chrome.runtime.sendMessage({ type: "DELETE_CONVERSATION", id: conv.id });
          }
          alert("\u6570\u636E\u5DF2\u6E05\u7A7A");
          await handleSearch();
          await loadStatistics();
        }
      } catch (error) {
        alert("\u6E05\u7A7A\u6570\u636E\u5931\u8D25");
      }
    }
  }
  function markdownToHtml(text) {
    if (!text)
      return "";
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text;
    }
    let html = text;
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>");
    html = html.replace(/^#### (.*$)/gim, "<h4>$1</h4>");
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    const lines = html.split("\n");
    const processedLines = [];
    let inList = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const listMatch = line.match(/^[\s]*[-*+]\s+(.+)$/) || line.match(/^[\s]*\d+\.\s+(.+)$/);
      if (listMatch) {
        if (!inList) {
          processedLines.push("<ul>");
          inList = true;
        }
        processedLines.push(`<li>${listMatch[1]}</li>`);
      } else {
        if (inList) {
          processedLines.push("</ul>");
          inList = false;
        }
        processedLines.push(line);
      }
    }
    if (inList) {
      processedLines.push("</ul>");
    }
    html = processedLines.join("\n");
    html = html.replace(/^---$/gim, "<hr>");
    html = html.replace(/^\*\*\*$/gim, "<hr>");
    html = html.replace(/\n\n+/g, "</p><p>");
    html = html.replace(/\n/g, "<br>");
    if (!html.trim().startsWith("<")) {
      html = "<p>" + html + "</p>";
    }
    return html;
  }
  function sanitizeHtmlForDisplay(html) {
    if (!html)
      return "";
    const hasMarkdown = /(\*\*|__|`|\[.*\]\(.*\)|^#{1,6}\s)/m.test(html);
    let processedHtml = html;
    if (hasMarkdown && !html.includes("<")) {
      processedHtml = markdownToHtml(html);
    }
    const temp = document.createElement("div");
    temp.innerHTML = processedHtml;
    const scripts = temp.querySelectorAll("script, style, iframe, object, embed, form, input, button");
    scripts.forEach((el) => el.remove());
    const allElements = temp.querySelectorAll("*");
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.startsWith("on") || attr.name === "jslog" || attr.name.startsWith("data-ved") || attr.name.startsWith("data-hveid") || attr.name.startsWith("_ng") || attr.name.startsWith("ng-")) {
          el.removeAttribute(attr.name);
        }
      });
    });
    const links = temp.querySelectorAll("a");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("javascript:")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      } else {
        const parent = link.parentElement;
        if (parent) {
          while (link.firstChild) {
            parent.insertBefore(link.firstChild, link);
          }
          parent.removeChild(link);
        }
      }
    });
    const images = temp.querySelectorAll("img");
    images.forEach((img) => {
      const src = img.getAttribute("src");
      if (!src || !src.startsWith("data:") && !src.startsWith("http")) {
        img.remove();
      }
    });
    return temp.innerHTML;
  }
  init();
})();
