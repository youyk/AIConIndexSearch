import { ConversationIndexer } from './indexer';
import { Conversation } from '../shared/types';
import { ConversationStorage } from '../shared/storage';
import { ExportManager } from '../shared/export-manager';
import { DomainConfigManager } from '../shared/domain-config';

const indexer = new ConversationIndexer();
const storage = new ConversationStorage();
const exportManager = new ExportManager(storage);
const domainConfig = new DomainConfigManager();

// 初始化
indexer.init().catch(console.error);
storage.init().catch(console.error);

// 更新图标状态
async function updateIconForTab(tabId?: number): Promise<void> {
  try {
    let url: string | undefined;
    
    if (tabId) {
      const tab = await chrome.tabs.get(tabId);
      url = tab.url;
    } else {
      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url) {
        url = tabs[0].url;
      }
    }
    
    if (!url) {
      // 如果没有URL，使用默认图标（启用状态）
      await chrome.action.setIcon({
        path: {
          16: 'icons/icon16.png',
          48: 'icons/icon48.png',
          128: 'icons/icon128.png'
        }
      });
      return;
    }
    
    // 提取域名
    let domain: string;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
    } catch {
      // 无效URL，使用默认图标
      await chrome.action.setIcon({
        path: {
          16: 'icons/icon16.png',
          48: 'icons/icon48.png',
          128: 'icons/icon128.png'
        }
      });
      return;
    }
    
    // 检查域名是否启用
    const isEnabled = await domainConfig.isDomainTracked(domain);
    
    // 根据状态设置图标
    if (isEnabled) {
      await chrome.action.setIcon({
        path: {
          16: 'icons/icon16.png',
          48: 'icons/icon48.png',
          128: 'icons/icon128.png'
        }
      });
    } else {
      await chrome.action.setIcon({
        path: {
          16: 'icons/icon16_disabled.png',
          48: 'icons/icon48_disabled.png',
          128: 'icons/icon128_disabled.png'
        }
      });
    }
  } catch (error) {
    // 出错时使用默认图标
    try {
      await chrome.action.setIcon({
        path: {
          16: 'icons/icon16.png',
          48: 'icons/icon48.png',
          128: 'icons/icon128.png'
        }
      });
    } catch {}
  }
}

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateIconForTab(activeInfo.tabId);
});

// 监听标签页更新事件（URL变化）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    await updateIconForTab(tabId);
  }
});

// 初始化时更新图标
updateIconForTab().catch(console.error);

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse).catch(console.error);
  return true; // 异步响应
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  try {
    switch (message.type) {
      case 'NEW_CONVERSATION':
        // 检查是否已存在相同ID的对话
        const existing = await storage.get(message.data.id);
        if (existing) {
          sendResponse({ success: true, duplicate: true });
        } else {
          // 检查存储限制
          const storageCheck = await storage.checkStorageLimit();
          if (!storageCheck.canSave) {
            sendResponse({ 
              success: false, 
              error: 'STORAGE_LIMIT_EXCEEDED',
              storageWarning: storageCheck.warning
            });
            break;
          }
          
          await indexer.addConversation(message.data as Conversation);
          
          // 再次检查存储使用情况，如果接近上限则警告
          const newStorageCheck = await storage.checkStorageLimit();
          sendResponse({ 
            success: true, 
            duplicate: false,
            storageWarning: newStorageCheck.warning
          });
        }
        break;

      case 'SEARCH_CONVERSATIONS':
        const searchResults = await indexer.search(message.query, message.options);
        sendResponse({ results: searchResults });
        break;

      case 'GET_CONVERSATION':
        const conv = await storage.get(message.id);
        sendResponse({ conversation: conv });
        break;

      case 'UPDATE_CONVERSATION':
        await indexer.updateConversation(message.id, message.updates);
        sendResponse({ success: true });
        break;

      case 'DELETE_CONVERSATION':
        await indexer.deleteConversation(message.id);
        sendResponse({ success: true });
        break;

      case 'GET_ALL_CONVERSATIONS':
        const all = await storage.getAll();
        sendResponse({ conversations: all });
        break;

      case 'CHECK_CONVERSATION_IDS':
        // 检查哪些对话ID已存在（使用高效的批量查询）
        const idsToCheck = message.ids as string[];
        const existingIds = await storage.checkExistingIds(idsToCheck);
        sendResponse({ existingIds });
        break;

      case 'GET_PLATFORMS':
        const platforms = await storage.getPlatforms();
        sendResponse({ platforms });
        break;

      case 'GET_TAGS':
        const tags = await storage.getTags();
        sendResponse({ tags });
        break;

      case 'GET_STATISTICS':
        const statistics = await storage.getStatistics();
        const storageLocation = storage.getStorageLocation();
        const storageLimit = await storage.checkStorageLimit();
        sendResponse({ 
          statistics,
          storageLocation,
          storageLimit
        });
        break;

      case 'EXPORT_CONVERSATIONS':
        const exportContent = await exportManager.export(
          message.format,
          { conversationIds: message.conversationIds }
        );
        sendResponse({ content: exportContent });
        break;

      case 'UPDATE_DOMAIN_CONFIG':
        // 域名配置更新时，更新图标
        await updateIconForTab();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[AI KB Background] Error:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
