import { Conversation, SearchResult, TrackedDomain } from '../shared/types';
import { DomainConfigManager } from '../shared/domain-config';
import { formatDate, truncate, escapeHtml } from '../shared/utils';

// DOM元素
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const filterToggleBtn = document.getElementById('filter-toggle-btn') as HTMLButtonElement;
const filtersPanel = document.getElementById('filters-panel') as HTMLDivElement;
const platformFilter = document.getElementById('platform-filter') as HTMLSelectElement;
const startDateFilter = document.getElementById('start-date') as HTMLInputElement;
const endDateFilter = document.getElementById('end-date') as HTMLInputElement;
const tagsFilter = document.getElementById('tags-filter') as HTMLSelectElement;
const favoriteOnlyCheckbox = document.getElementById('favorite-only') as HTMLInputElement;
const resultsList = document.getElementById('results-list') as HTMLDivElement;
const resultsCount = document.getElementById('results-count') as HTMLDivElement;
const noResults = document.getElementById('no-results') as HTMLDivElement;
const detailView = document.getElementById('detail-view') as HTMLDivElement;
const detailContent = document.getElementById('detail-content') as HTMLDivElement;
const conversationDetail = document.getElementById('conversation-detail') as HTMLDivElement;
const batchActions = document.getElementById('batch-actions') as HTMLDivElement;
const batchExportBtn = document.getElementById('batch-export-btn') as HTMLButtonElement;
const batchDeleteBtn = document.getElementById('batch-delete-btn') as HTMLButtonElement;
const selectAllCheckbox = document.getElementById('select-all-checkbox') as HTMLInputElement;
const backBtn = document.getElementById('back-btn') as HTMLButtonElement;
const settingsView = document.getElementById('settings-view') as HTMLDivElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsBackBtn = document.getElementById('settings-back-btn') as HTMLButtonElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const exportAllBtn = document.getElementById('export-all-btn') as HTMLButtonElement;
const clearDataBtn = document.getElementById('clear-data-btn') as HTMLButtonElement;
const exportDialog = document.getElementById('export-dialog') as HTMLDivElement;
const exportDialogClose = document.getElementById('export-dialog-close') as HTMLButtonElement;
const exportDialogDescription = document.getElementById('export-dialog-description') as HTMLParagraphElement;
const domainsList = document.getElementById('domains-list') as HTMLDivElement;
const newDomainInput = document.getElementById('new-domain-input') as HTMLInputElement;
const addDomainBtn = document.getElementById('add-domain-btn') as HTMLButtonElement;

const domainConfig = new DomainConfigManager();

let currentConversation: Conversation | null = null;
let searchDebounceTimer: number | null = null;
let currentSearchResultIds: string[] = []; // 保存当前搜索结果的ID列表
let currentSearchResults: SearchResult[] = []; // 保存当前搜索结果
let selectedConversationIds = new Set<string>(); // 选中的对话ID

// 初始化
async function init() {
  await loadPlatforms();
  await loadTags();
  await loadDomains();
  setupEventListeners();
}

function setupEventListeners() {
  // 搜索
  searchInput.addEventListener('input', handleSearch);
  
  // 筛选
  filterToggleBtn.addEventListener('click', () => {
    filtersPanel.style.display = filtersPanel.style.display === 'none' ? 'block' : 'none';
  });
  
  platformFilter.addEventListener('change', handleSearch);
  startDateFilter.addEventListener('change', handleSearch);
  endDateFilter.addEventListener('change', handleSearch);
  tagsFilter.addEventListener('change', handleSearch);
  favoriteOnlyCheckbox.addEventListener('change', handleSearch);
  
  // 导航
  backBtn.addEventListener('click', showMainView);
  settingsBtn.addEventListener('click', showSettingsView);
  settingsBackBtn.addEventListener('click', showMainView);
  
  // 导出
  exportBtn.addEventListener('click', () => showExportDialog('search'));
  exportAllBtn.addEventListener('click', () => showExportDialog('all'));
  exportDialogClose.addEventListener('click', closeExportDialog);
  
  // 导出格式选择（事件委托）
  exportDialog.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const formatOption = target.closest('.format-option') as HTMLButtonElement;
    if (formatOption) {
      const format = formatOption.dataset.format as 'json' | 'markdown' | 'html' | 'csv' | 'pdf';
      if (format) {
        handleExportFormatSelection(format);
      }
    }
  });
  
  // 点击对话框背景关闭
  exportDialog.addEventListener('click', (e) => {
    if (e.target === exportDialog) {
      closeExportDialog();
    }
  });
  
  // 详情视图按钮（事件委托）
  detailContent.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button') as HTMLButtonElement;
    if (!btn) return;
    
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    
    if (action === 'toggle-favorite' && id) {
      toggleFavorite(id);
    } else if (action === 'delete' && id) {
      deleteConversation(id);
    } else if (action === 'export' && id) {
      showExportDialog('selected', [id]);
    }
  });
  
  // 域名管理按钮（事件委托）
  domainsList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button') as HTMLButtonElement;
    if (!btn) return;
    
    const action = btn.dataset.action;
    const domain = btn.dataset.domain;
    
    if (action === 'remove' && domain) {
      removeDomain(domain);
    }
  });
  
  // 域名开关（事件委托）
  domainsList.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.type === 'checkbox' && target.dataset.domain) {
      toggleDomain(target.dataset.domain, target.checked);
    }
  });
  
  // 批量操作
  batchExportBtn.addEventListener('click', handleBatchExport);
  batchDeleteBtn.addEventListener('click', handleBatchDelete);
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  
  // 对话列表复选框（事件委托）
  resultsList.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.type === 'checkbox' && target.classList.contains('conversation-checkbox')) {
      updateBatchActions();
    }
  });
  
  // 对话项点击（事件委托）
  resultsList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.conversation-item') as HTMLElement;
    if (!item) return;
    
    // 如果点击的是复选框，不触发选择
    if (target.type === 'checkbox' || target.closest('input[type="checkbox"]')) {
      return;
    }
    
    const id = item.dataset.id;
    if (id) {
      selectConversation(id);
    }
  });
  
  // 域名管理
  addDomainBtn.addEventListener('click', addDomain);
  
  // 清空数据
  clearDataBtn.addEventListener('click', clearAllData);
}

async function handleSearch() {
  const query = searchInput.value.trim();
  
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  
  searchDebounceTimer = window.setTimeout(async () => {
    const options: any = {};
    
    if (platformFilter.value) {
      options.platform = platformFilter.value;
    }
    
    if (startDateFilter.value) {
      options.startDate = new Date(startDateFilter.value).getTime();
    }
    
    if (endDateFilter.value) {
      options.endDate = new Date(endDateFilter.value).getTime() + 86400000; // +1 day
    }
    
    if (tagsFilter.selectedOptions.length > 0) {
      options.tags = Array.from(tagsFilter.selectedOptions).map(opt => opt.value);
    }
    
    if (favoriteOnlyCheckbox.checked) {
      options.favoriteOnly = true;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_CONVERSATIONS',
        query,
        options
      });
      
      if (response && response.results) {
        displayResults(response.results);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }, 300);
}

/**
 * 按title分组对话（优先使用conversation.title，如果没有则使用问题前30个字符）
 */
function groupByTitle(results: SearchResult[]): Record<string, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {};
  
  results.forEach(result => {
    const conv = result.conversation;
    let title = '未分类对话';
    
    // 1. 优先使用conversation.title（从页面提取的标题）
    if (conv.title && conv.title.trim().length > 0) {
      title = conv.title.trim();
    }
    // 2. 如果没有title，尝试从pageUrl提取
    else if (conv.pageUrl) {
      try {
        const url = new URL(conv.pageUrl);
        const pathParts = url.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
          const urlTitle = decodeURIComponent(pathParts[pathParts.length - 1]);
          // 检查是否是有效的title（不是hash值）
          if (urlTitle.length > 3 && !/^[a-f0-9]{16,}$/i.test(urlTitle)) {
            title = urlTitle;
          }
        }
      } catch (e) {
        // 忽略URL解析错误
      }
    }
    
    // 3. 如果还是没有有效的title，使用问题前30个字符
    if (title === '未分类对话' || title.length < 3) {
      title = truncate(conv.question, 30) || '未分类对话';
    }
    
    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(result);
  });
  
  return groups;
}

/**
 * 创建对话列表项（左侧）
 */
function createConversationListItem(result: SearchResult, isFirst: boolean): HTMLDivElement {
  const { conversation, highlights } = result;
  const item = document.createElement('div');
  item.className = 'conversation-item';
  item.dataset.id = conversation.id;
  
  if (isFirst) {
    item.classList.add('selected');
  }
  
  const questionPreview = truncate(conversation.question, 50);
  const favoriteBadge = conversation.favorite ? '<span class="favorite-badge">⭐</span>' : '';
  
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

function displayResults(results: SearchResult[]) {
  resultsList.innerHTML = '';
  selectedConversationIds.clear();
  
  // 保存当前搜索结果
  currentSearchResults = results;
  currentSearchResultIds = results.map(r => r.conversation.id);
  
  if (results.length === 0) {
    noResults.style.display = 'block';
    resultsCount.textContent = '';
    batchActions.style.display = 'none';
    conversationDetail.innerHTML = '<div class="detail-placeholder"><p>请从左侧选择一个对话查看详情</p></div>';
    return;
  }
  
  noResults.style.display = 'none';
  resultsCount.textContent = `找到 ${results.length} 条结果`;
  batchActions.style.display = 'flex';
  
  // 按title分组（如果没有title，使用问题前30个字符作为title）
  const groupedResults = groupByTitle(results);
  
  // 显示分组列表
  Object.entries(groupedResults).forEach(([title, items]) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'conversation-group';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'group-title';
    titleDiv.textContent = title;
    groupDiv.appendChild(titleDiv);
    
    items.forEach((result, index) => {
      const item = createConversationListItem(result, index === 0 && Object.keys(groupedResults).length === 1);
      groupDiv.appendChild(item);
    });
    
    resultsList.appendChild(groupDiv);
  });
  
  // 默认选中并显示第一个对话
  if (results.length > 0) {
    const firstId = results[0].conversation.id;
    selectConversation(firstId);
  }
}

function createConversationCard(result: SearchResult): HTMLDivElement {
  const { conversation, highlights } = result;
  const card = document.createElement('div');
  card.className = 'conversation-card';
  
  const tagsHtml = conversation.tags && conversation.tags.length > 0
    ? `<div class="tags">${conversation.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';
  
  const favoriteBadge = conversation.favorite ? '<span class="favorite-badge">⭐</span>' : '';
  
  card.innerHTML = `
    <div class="card-header">
      <span class="platform-badge">${escapeHtml(conversation.platform)}</span>
      <span class="timestamp">${formatDate(conversation.timestamp)}</span>
      ${favoriteBadge}
    </div>
    <div class="question-preview">${highlightText(conversation.question, highlights.question)}</div>
    <div class="answer-preview">${highlightText(truncate(conversation.answer, 150), highlights.answer)}</div>
    ${tagsHtml}
  `;
  
  card.addEventListener('click', () => showConversationDetail(conversation));
  
  return card;
}

function highlightText(text: string, highlights: string[]): string {
  let highlighted = escapeHtml(text);
  highlights.forEach(term => {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });
  return highlighted;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 选中对话并显示详情
 */
async function selectConversation(id: string) {
  // 更新选中状态
  document.querySelectorAll('.conversation-item').forEach(item => {
    if (item instanceof HTMLElement && item.dataset.id === id) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  
  // 查找对话
  const result = currentSearchResults.find(r => r.conversation.id === id);
  if (!result) return;
  
  await showConversationDetail(result.conversation, result.highlights);
}

async function showConversationDetail(conv: Conversation, highlights?: { question: string[]; answer: string[] }) {
  currentConversation = conv;
  
  const tagsHtml = conv.tags && conv.tags.length > 0
    ? `<div class="tags">${conv.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';
  
  const notesHtml = conv.notes
    ? `<div class="detail-section">
        <span class="label">笔记：</span>
        <div class="text">${escapeHtml(conv.notes)}</div>
      </div>`
    : '';
  
  // 在详情视图中使用HTML格式（如果存在），否则使用纯文本
  const questionContent = conv.questionHtml 
    ? sanitizeHtmlForDisplay(conv.questionHtml) 
    : escapeHtml(conv.question);
  const answerContent = conv.answerHtml 
    ? sanitizeHtmlForDisplay(conv.answerHtml) 
    : escapeHtml(conv.answer);
  
  conversationDetail.innerHTML = `
    <div class="detail-header-info">
      <div class="detail-title">
        <span class="platform-badge">${escapeHtml(conv.platform)}</span>
        <span class="detail-date">${formatDate(conv.timestamp)}</span>
        ${conv.favorite ? '<span class="favorite-badge">⭐</span>' : ''}
      </div>
    </div>
    <div class="detail-sections">
      <div class="detail-section">
        <div class="section-label">问题</div>
        <div class="section-content ${conv.questionHtml ? 'formatted-content' : ''}">${questionContent}</div>
      </div>
      <div class="detail-section">
        <div class="section-label">回答</div>
        <div class="section-content ${conv.answerHtml ? 'formatted-content' : ''}">${answerContent}</div>
      </div>
      ${tagsHtml ? `<div class="detail-section"><div class="section-label">标签</div><div class="section-content">${tagsHtml}</div></div>` : ''}
      ${notesHtml ? `<div class="detail-section"><div class="section-label">笔记</div><div class="section-content">${notesHtml}</div></div>` : ''}
    </div>
    <div class="detail-actions">
      <button class="action-btn" data-action="toggle-favorite" data-id="${conv.id}">
        ${conv.favorite ? '取消收藏' : '收藏'}
      </button>
      <button class="action-btn" data-action="delete" data-id="${conv.id}">删除</button>
      <button class="action-btn" data-action="export" data-id="${conv.id}">导出</button>
    </div>
  `;
  
  // 详情视图按钮（事件委托）
  conversationDetail.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button') as HTMLButtonElement;
    if (!btn) return;
    
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    
    if (action === 'toggle-favorite' && id) {
      toggleFavorite(id);
    } else if (action === 'delete' && id) {
      deleteConversation(id);
    } else if (action === 'export' && id) {
      showExportDialog('selected', [id]);
    }
  });
}

function showDetailView() {
  document.querySelector('.results-section')!.setAttribute('style', 'display: none');
  detailView.style.display = 'block';
}

function showMainView() {
  detailView.style.display = 'none';
  settingsView.style.display = 'none';
  document.querySelector('.results-section')!.setAttribute('style', 'display: block');
}

function showSettingsView() {
  document.querySelector('.results-section')!.setAttribute('style', 'display: none');
  detailView.style.display = 'none';
  settingsView.style.display = 'block';
  loadStatistics();
}

async function loadPlatforms() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PLATFORMS' });
    if (response && response.platforms) {
      platformFilter.innerHTML = '<option value="">全部</option>';
      response.platforms.forEach((platform: string) => {
        const option = document.createElement('option');
        option.value = platform;
        option.textContent = platform;
        platformFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Load platforms error:', error);
  }
}

async function loadTags() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TAGS' });
    if (response && response.tags) {
      tagsFilter.innerHTML = '';
      response.tags.forEach((tag: string) => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagsFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Load tags error:', error);
  }
}

async function loadDomains() {
  const domains = await domainConfig.getDomains();
  domainsList.innerHTML = '';
  
  domains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `
      <input type="checkbox" ${domain.enabled ? 'checked' : ''} 
             data-domain="${escapeHtml(domain.domain)}">
      <span>${escapeHtml(domain.name || domain.domain)}</span>
      <span style="color: #888; font-size: 12px;">${escapeHtml(domain.domain)}</span>
      <button class="action-btn" data-action="remove" data-domain="${escapeHtml(domain.domain)}" style="margin-left: auto;">删除</button>
    `;
    domainsList.appendChild(item);
  });
}

async function addDomain() {
  const domain = newDomainInput.value.trim();
  if (domain) {
    await domainConfig.addDomain(domain);
    newDomainInput.value = '';
    await loadDomains();
  }
}

async function toggleDomain(domain: string, enabled: boolean) {
  await domainConfig.updateDomain(domain, { enabled });
}

async function removeDomain(domain: string) {
  if (confirm('确定要删除这个域名吗？')) {
    await domainConfig.removeDomain(domain);
    await loadDomains();
  }
}

/**
 * 更新批量操作按钮状态
 */
function updateBatchActions() {
  const checkedBoxes = resultsList.querySelectorAll('.conversation-checkbox:checked') as NodeListOf<HTMLInputElement>;
  selectedConversationIds.clear();
  checkedBoxes.forEach(cb => {
    selectedConversationIds.add(cb.dataset.id!);
  });
  
  const count = selectedConversationIds.size;
  if (count > 0) {
    batchExportBtn.textContent = `导出选中 (${count})`;
    batchDeleteBtn.textContent = `删除选中 (${count})`;
    batchActions.style.display = 'flex';
  } else {
    batchActions.style.display = 'none';
  }
  
  // 更新全选状态
  const allBoxes = resultsList.querySelectorAll('.conversation-checkbox') as NodeListOf<HTMLInputElement>;
  selectAllCheckbox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
}

/**
 * 全选/取消全选
 */
function handleSelectAll() {
  const checkboxes = resultsList.querySelectorAll('.conversation-checkbox') as NodeListOf<HTMLInputElement>;
  checkboxes.forEach(cb => {
    cb.checked = selectAllCheckbox.checked;
  });
  updateBatchActions();
}

/**
 * 批量导出
 */
async function handleBatchExport() {
  const ids = Array.from(selectedConversationIds);
  if (ids.length === 0) {
    alert('请先选择要导出的对话');
    return;
  }
  showExportDialog('selected', ids);
}

/**
 * 批量删除
 */
async function handleBatchDelete() {
  const ids = Array.from(selectedConversationIds);
  if (ids.length === 0) {
    alert('请先选择要删除的对话');
    return;
  }
  
  if (!confirm(`确定要删除选中的 ${ids.length} 条对话吗？`)) {
    return;
  }
  
  try {
    await Promise.all(ids.map(id => chrome.runtime.sendMessage({ type: 'DELETE_CONVERSATION', id })));
    selectedConversationIds.clear();
    await handleSearch();
  } catch (error) {
    console.error('Batch delete error:', error);
    alert('删除失败，请重试');
  }
}

async function toggleFavorite(id: string) {
  const conv = currentConversation;
  if (!conv) return;
  
  await chrome.runtime.sendMessage({
    type: 'UPDATE_CONVERSATION',
    id,
    updates: { favorite: !conv.favorite }
  });
  
  await handleSearch();
}

async function deleteConversation(id: string) {
  if (confirm('确定要删除这条对话吗？')) {
    await chrome.runtime.sendMessage({ type: 'DELETE_CONVERSATION', id });
    await handleSearch();
  }
}

let pendingExportType: 'all' | 'selected' | 'search' = 'all';
let pendingExportIds: string[] | undefined = undefined;

function showExportDialog(type: 'all' | 'selected' | 'search', ids?: string[]) {
  pendingExportType = type;
  pendingExportIds = ids;
  
  // 设置对话框描述
  let description = '请选择导出格式：';
  if (type === 'all') {
    description = '导出所有对话数据，请选择格式：';
  } else if (type === 'selected') {
    description = `导出选中的 ${ids?.length || 0} 条对话，请选择格式：`;
  } else if (type === 'search') {
    description = '导出当前搜索结果，请选择格式：';
  }
  exportDialogDescription.textContent = description;
  
  exportDialog.style.display = 'flex';
}

function closeExportDialog() {
  exportDialog.style.display = 'none';
  pendingExportType = 'all';
  pendingExportIds = undefined;
}

async function handleExportFormatSelection(format: 'json' | 'markdown' | 'html' | 'csv' | 'pdf') {
  // 先保存参数，再关闭对话框
  const exportType = pendingExportType;
  const exportIds = pendingExportIds ? [...pendingExportIds] : undefined;
  
  closeExportDialog();
  
  let type: 'all' | 'selected' = 'all';
  let ids: string[] | undefined = undefined;
  
  if (exportType === 'selected' && exportIds && exportIds.length > 0) {
    // 导出选中的对话
    type = 'selected';
    ids = exportIds;
  } else if (exportType === 'search') {
    // 导出当前搜索结果
    if (currentSearchResultIds.length > 0) {
      type = 'selected';
      ids = [...currentSearchResultIds];
    } else {
      // 如果没有搜索结果，提示用户
      alert('当前没有搜索结果，请先进行搜索');
      return;
    }
  }
  // 如果 exportType === 'all'，则 type 保持为 'all'，ids 为 undefined
  
  await exportData(type, ids, format);
}

async function exportData(type: 'all' | 'selected', ids?: string[], format?: 'json' | 'markdown' | 'html' | 'csv' | 'pdf') {
  // 如果没有指定格式，显示对话框
  if (!format) {
    if (type === 'selected' && ids) {
      showExportDialog('selected', ids);
    } else {
      showExportDialog('all');
    }
    return;
  }
  
  try {
    // 验证导出数据
    if (type === 'selected' && (!ids || ids.length === 0)) {
      alert('没有可导出的对话');
      return;
    }
    
    
    if (format === 'pdf') {
      // PDF导出需要特殊处理
      await exportToPDF(type, ids);
      return;
    }
    
    // 通过background script导出其他格式
    const message = {
      type: 'EXPORT_CONVERSATIONS',
      format: format
    };
    
    if (type === 'selected' && ids && ids.length > 0) {
      (message as any).conversationIds = ids;
    }
    
    const response = await chrome.runtime.sendMessage(message);
    
    if (response && response.content) {
      const extensions = { json: 'json', markdown: 'md', html: 'html', csv: 'csv' };
      const mimeTypes = { json: 'application/json', markdown: 'text/markdown', html: 'text/html', csv: 'text/csv' };
      
      const count = type === 'selected' && ids ? ids.length : 'all';
      const filename = `ai-conversations-${count}-${Date.now()}.${extensions[format]}`;
      downloadFile(response.content, filename, mimeTypes[format]);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('导出失败，请重试');
  }
}

/**
 * 导出为PDF
 */
async function exportToPDF(type: 'all' | 'selected', ids?: string[]) {
  try {
    // 使用本地加载的html2pdf.js
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
      alert('PDF导出功能未正确加载，请重新加载插件');
      return;
    }
    
    // 获取对话数据
    let conversations: Conversation[];
    if (type === 'selected' && ids && ids.length > 0) {
      const responses = await Promise.all(
        ids.map(id => chrome.runtime.sendMessage({ type: 'GET_CONVERSATION', id }))
      );
      conversations = responses
        .map(r => r.conversation)
        .filter((c): c is Conversation => c !== null);
    } else {
      const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
      conversations = response?.conversations || [];
    }
    
    if (conversations.length === 0) {
      alert('没有可导出的对话');
      return;
    }
    
    // 生成HTML内容
    const htmlContent = generatePDFHTML(conversations);
    
    
    // 使用iframe来隔离内容，确保样式正确应用
    const iframe = document.createElement('iframe');
    iframe.id = 'pdf-export-iframe';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.visibility = 'hidden';
    iframe.style.opacity = '0';
    
    document.body.appendChild(iframe);
    
    // 等待iframe加载
    await new Promise((resolve) => {
      iframe.onload = resolve;
      iframe.src = 'about:blank';
    });
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      alert('无法创建PDF导出容器');
      document.body.removeChild(iframe);
      return;
    }
    
    // 写入完整HTML到iframe
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    
    
    // 等待iframe内容渲染
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 获取iframe的body元素
    const iframeBody = iframeDoc.body;
    if (!iframeBody) {
      alert('iframe内容加载失败');
      document.body.removeChild(iframe);
      return;
    }
    
    // 验证内容
    const hasContent = iframeBody.textContent && iframeBody.textContent.trim().length > 0;
    const childCount = iframeBody.children.length;
    
    
    if (!hasContent || childCount === 0) {
      alert('PDF内容为空，请检查对话数据。对话数量：' + conversations.length + '\n文本长度：' + (iframeBody.textContent?.length || 0));
      document.body.removeChild(iframe);
      return;
    }
    
    // 确保iframe可见（但不在用户视野中）
    iframe.style.visibility = 'visible';
    iframe.style.opacity = '1';
    
    // 再次等待确保完全渲染
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 配置PDF选项
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `ai-conversations-${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: true,
        letterRendering: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: iframeBody.scrollWidth || 794, // A4 width in pixels at 96dpi
        windowHeight: iframeBody.scrollHeight || 1123, // A4 height in pixels
        width: iframeBody.scrollWidth || 794,
        height: iframeBody.scrollHeight || 1123
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    try {
      // 生成PDF - 从iframe的body元素
      const pdfPromise = html2pdf()
        .set(opt)
        .from(iframeBody)
        .save();
      
      await pdfPromise;
      
      // 等待PDF生成完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 清理
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      
      alert(`成功导出 ${conversations.length} 条对话为PDF`);
    } catch (pdfError) {
      // 静默处理错误，仅显示用户友好的提示
      alert('PDF导出失败，请重试');
      
      // 确保清理
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      
      alert('PDF导出失败：' + (pdfError instanceof Error ? pdfError.message : '未知错误') + '\n请查看控制台获取详细信息');
      throw pdfError;
    }
  } catch (error) {
    console.error('PDF export error:', error);
    alert('PDF导出失败：' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 生成PDF用的HTML内容
 */
function generatePDFHTML(conversations: Conversation[]): string {
  const date = new Date().toLocaleString('zh-CN');
  const total = conversations.length;
  
  // 添加测试内容，验证PDF生成工具是否正常工作
  const testContent = `
    <div style="background: yellow; padding: 20px; margin: 20px; border: 3px solid red;">
      <h1 style="color: red; font-size: 24px;">🧪 PDF生成测试内容 🧪</h1>
      <p style="font-size: 18px; color: blue;">如果您能看到这段文字，说明PDF生成工具正常工作！</p>
      <p style="font-size: 16px;">当前时间：${date}</p>
      <p style="font-size: 16px;">对话数量：${total}</p>
      <p style="font-size: 14px; color: green;">这是一段测试文字，用于验证html2pdf.js是否能正确生成PDF文件。</p>
    </div>
  `;
  
  const conversationsHTML = conversations.map((conv, index) => {
    const dateStr = formatDate(conv.timestamp);
    const tags = conv.tags && conv.tags.length > 0
      ? `<div class="tags">${conv.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
      : '';
    const notes = conv.notes ? `<div class="notes"><strong>笔记：</strong>${escapeHtml(conv.notes)}</div>` : '';
    const favorite = conv.favorite ? '<span class="favorite">⭐</span>' : '';
    
    // 使用HTML格式（如果存在）
    // 注意：在PDF中，我们需要确保HTML被正确渲染，而不是作为文本显示
    let questionContent: string;
    let answerContent: string;
    
    if (conv.questionHtml) {
      // 清理HTML但保留格式标签
      // 如果包含markdown标记，先转换为HTML
      questionContent = sanitizeHtmlForDisplay(conv.questionHtml);
    } else {
      // 纯文本，检查是否包含markdown标记
      if (/(\*\*|__|`|\[.*\]\(.*\)|^#{1,6}\s)/m.test(conv.question)) {
        questionContent = sanitizeHtmlForDisplay(conv.question);
      } else {
        questionContent = escapeHtml(conv.question);
      }
    }
    
    if (conv.answerHtml) {
      // 清理HTML但保留格式标签
      // 如果包含markdown标记，先转换为HTML
      answerContent = sanitizeHtmlForDisplay(conv.answerHtml);
    } else {
      // 纯文本，检查是否包含markdown标记
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
            <div class="label">问题：</div>
            <div class="text ${conv.questionHtml ? 'formatted-content' : ''}">${questionContent}</div>
          </div>
          <div class="answer">
            <div class="label">回答：</div>
            <div class="text ${conv.answerHtml ? 'formatted-content' : ''}">${answerContent}</div>
          </div>
          ${tags}
          ${notes}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI对话知识库导出</title>
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
        <h1>AI对话知识库导出</h1>
        <div class="meta">
          导出时间：${escapeHtml(date)} | 共 ${total} 条对话
        </div>
      </div>
      <div class="conversations-container">
        ${conversationsHTML}
      </div>
    </body>
    </html>
  `;
}


function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function loadStatistics() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATISTICS' });
    if (response && response.statistics) {
      const stats = response.statistics;
      const storageLocation = response.storageLocation || 'IndexedDB: ai-conversation-kb';
      const storageLimit = response.storageLimit;
      
      // 更新统计信息
      const totalCountEl = document.getElementById('stat-total-count');
      const totalSizeEl = document.getElementById('stat-total-size');
      const storageLocationEl = document.getElementById('stat-storage-location');
      const oldestDateEl = document.getElementById('stat-oldest-date');
      const newestDateEl = document.getElementById('stat-newest-date');
      const platformsListEl = document.getElementById('platform-stats-list');
      const storageWarningEl = document.getElementById('storage-warning');
      
      if (totalCountEl) {
        totalCountEl.textContent = stats.totalCount.toString();
      }
      
      if (totalSizeEl && storageLimit) {
        const usagePercent = (storageLimit.usagePercent * 100).toFixed(1);
        // 格式化最大存储大小
        const formatBytes = (bytes: number): string => {
          if (bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        };
        const maxSizeFormatted = formatBytes(storageLimit.maxSize);
        totalSizeEl.textContent = `${stats.sizeFormatted} / ${maxSizeFormatted} (${usagePercent}%)`;
        
        // 根据使用率设置颜色
        if (storageLimit.usagePercent >= 0.95) {
          totalSizeEl.style.color = '#d32f2f'; // 红色
        } else if (storageLimit.usagePercent >= 0.8) {
          totalSizeEl.style.color = '#f57c00'; // 橙色
        } else {
          totalSizeEl.style.color = '';
        }
      } else if (totalSizeEl) {
        totalSizeEl.textContent = stats.sizeFormatted;
      }
      
      if (storageLocationEl) {
        storageLocationEl.textContent = storageLocation;
      }
      
      if (oldestDateEl) {
        oldestDateEl.textContent = stats.oldestDate 
          ? formatDate(stats.oldestDate) 
          : '无';
      }
      
      if (newestDateEl) {
        newestDateEl.textContent = stats.newestDate 
          ? formatDate(stats.newestDate) 
          : '无';
      }
      
      // 显示存储警告
      if (storageWarningEl && storageLimit) {
        if (storageLimit.warning) {
          storageWarningEl.style.display = 'block';
          storageWarningEl.className = storageLimit.usagePercent >= 0.95 
            ? 'storage-warning critical' 
            : storageLimit.usagePercent >= 0.8 
            ? 'storage-warning warning' 
            : 'storage-warning';
          storageWarningEl.textContent = storageLimit.warning;
        } else {
          storageWarningEl.style.display = 'none';
        }
      }
      
      // 显示平台分布
      if (platformsListEl) {
        platformsListEl.innerHTML = '';
        const platforms = Object.entries(stats.platforms);
        if (platforms.length === 0) {
          platformsListEl.innerHTML = '<div class="platform-stat-item">暂无数据</div>';
        } else {
          platforms.forEach(([platform, count]) => {
            const item = document.createElement('div');
            item.className = 'platform-stat-item';
            item.innerHTML = `
              <span class="platform-name">${escapeHtml(platform)}</span>
              <span class="platform-count">${count} 条</span>
            `;
            platformsListEl.appendChild(item);
          });
        }
      }
    }
  } catch (error) {
    // 静默处理错误
  }
}

async function clearAllData() {
  if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
      if (response && response.conversations) {
        for (const conv of response.conversations) {
          await chrome.runtime.sendMessage({ type: 'DELETE_CONVERSATION', id: conv.id });
        }
        alert('数据已清空');
        await handleSearch();
        await loadStatistics(); // 刷新统计信息
      }
    } catch (error) {
      // 静默处理错误
      alert('清空数据失败');
    }
  }
}

/**
 * 将markdown标记转换为HTML（简单转换）
 * 注意：这个函数处理纯markdown文本，如果已经是HTML则直接返回
 */
function markdownToHtml(text: string): string {
  if (!text) return '';
  
  // 如果已经是HTML格式（包含HTML标签），直接返回
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  
  let html = text;
  
  // 代码块（多行）
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  
  // 行内代码（避免与代码块冲突）
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  
  // 粗体 **text** 或 __text__（避免与斜体冲突）
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  
  // 斜体 *text* 或 _text_（避免与粗体冲突）
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
  
  // 标题（必须在列表之前处理）
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // 列表项（有序和无序）
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const listMatch = line.match(/^[\s]*[-*+]\s+(.+)$/) || line.match(/^[\s]*\d+\.\s+(.+)$/);
    
    if (listMatch) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      processedLines.push(`<li>${listMatch[1]}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  
  if (inList) {
    processedLines.push('</ul>');
  }
  
  html = processedLines.join('\n');
  
  // 水平线
  html = html.replace(/^---$/gim, '<hr>');
  html = html.replace(/^\*\*\*$/gim, '<hr>');
  
  // 换行处理
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // 包装段落（如果还没有被包装）
  if (!html.trim().startsWith('<')) {
    html = '<p>' + html + '</p>';
  }
  
  return html;
}

/**
 * 清理HTML用于安全显示（保留格式，移除危险内容）
 * 如果内容包含markdown标记，先转换为HTML
 */
function sanitizeHtmlForDisplay(html: string): string {
  if (!html) return '';
  
  // 检查是否包含markdown标记（如果包含，先转换）
  const hasMarkdown = /(\*\*|__|`|\[.*\]\(.*\)|^#{1,6}\s)/m.test(html);
  
  let processedHtml = html;
  if (hasMarkdown && !html.includes('<')) {
    // 如果主要是markdown格式，转换为HTML
    processedHtml = markdownToHtml(html);
  }
  
  // 创建一个临时div来解析HTML
  const temp = document.createElement('div');
  temp.innerHTML = processedHtml;
  
  // 移除脚本和危险元素
  const scripts = temp.querySelectorAll('script, style, iframe, object, embed, form, input, button');
  scripts.forEach(el => el.remove());
  
  // 移除事件处理器
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || 
          attr.name === 'jslog' || 
          attr.name.startsWith('data-ved') ||
          attr.name.startsWith('data-hveid') ||
          attr.name.startsWith('_ng') ||
          attr.name.startsWith('ng-')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  // 清理链接
  const links = temp.querySelectorAll('a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('javascript:')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    } else {
      // 移除危险的链接
      const parent = link.parentElement;
      if (parent) {
        while (link.firstChild) {
          parent.insertBefore(link.firstChild, link);
        }
        parent.removeChild(link);
      }
    }
  });
  
  // 清理图片
  const images = temp.querySelectorAll('img');
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (!src || (!src.startsWith('data:') && !src.startsWith('http'))) {
      img.remove();
    }
  });
  
  return temp.innerHTML;
}

// 注意：所有事件处理已改为事件委托，不再需要全局函数

// 启动
init();
