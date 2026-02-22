import { ConversationIndexer } from './indexer';
import { Conversation } from '../shared/types';
import { ConversationStorage } from '../shared/storage';
import { ExportManager } from '../shared/export-manager';

const indexer = new ConversationIndexer();
const storage = new ConversationStorage();
const exportManager = new ExportManager(storage);

// 初始化
indexer.init().catch(console.error);
storage.init().catch(console.error);

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

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[AI KB Background] Error:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
