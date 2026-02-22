import { TrackedDomain } from './types';

export class DomainConfigManager {
  private storageKey = 'trackedDomains';

  async getDomains(): Promise<TrackedDomain[]> {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || this.getDefaultDomains();
  }

  async addDomain(domain: string, name?: string): Promise<void> {
    const domains = await this.getDomains();
    if (!domains.find(d => d.domain === domain)) {
      domains.push({
        domain,
        enabled: true,
        name: name || domain
      });
      await chrome.storage.local.set({ [this.storageKey]: domains });
    }
  }

  async removeDomain(domain: string): Promise<void> {
    const domains = await this.getDomains();
    const filtered = domains.filter(d => d.domain !== domain);
    await chrome.storage.local.set({ [this.storageKey]: filtered });
  }

  async updateDomain(domain: string, updates: Partial<TrackedDomain>): Promise<void> {
    const domains = await this.getDomains();
    const index = domains.findIndex(d => d.domain === domain);
    if (index !== -1) {
      domains[index] = { ...domains[index], ...updates };
      await chrome.storage.local.set({ [this.storageKey]: domains });
    }
  }

  async isDomainTracked(domain: string): Promise<boolean> {
    const domains = await this.getDomains();
    return domains.some(d => d.domain === domain && d.enabled);
  }

  private getDefaultDomains(): TrackedDomain[] {
    return [
      { domain: 'gemini.google.com', enabled: true, name: 'Google Gemini' },
      { domain: 'chat.openai.com', enabled: true, name: 'ChatGPT' },
      { domain: 'chat.deepseek.com', enabled: true, name: 'DeepSeek' },
      { domain: 'claude.ai', enabled: true, name: 'Claude' }
    ];
  }
}
