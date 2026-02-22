import { PlatformAdapter } from '../../shared/types';
import { ChatGPTAdapter } from './chatgpt';
import { GeminiAdapter } from './gemini';
import { DeepSeekAdapter } from './deepseek';

export function getPlatformAdapters(): PlatformAdapter[] {
  return [
    new ChatGPTAdapter(),
    new GeminiAdapter(),
    new DeepSeekAdapter()
  ];
}

export function detectPlatform(): PlatformAdapter | null {
  const adapters = getPlatformAdapters();
  return adapters.find(adapter => adapter.detect()) || null;
}
