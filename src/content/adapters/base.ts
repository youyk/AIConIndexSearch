import { PlatformAdapter, Conversation } from '../../shared/types';
import { generateId } from '../../shared/utils';

export abstract class BaseAdapter implements PlatformAdapter {
  abstract name: string;
  abstract detect(): boolean;
  abstract extractConversations(): Conversation[];

  setupListener(callback: (conv: Conversation) => void): void {
    // 子类实现具体的监听逻辑
  }

  protected generateId(element: Element, question: string, answer: string): string {
    // 基于内容和页面URL生成稳定的ID，避免重复记录
    const pageUrl = window.location.href;
    const contentHash = this.simpleHash(`${question}|${answer}`);
    const urlHash = this.simpleHash(pageUrl);
    return `${this.name}-${urlHash}-${contentHash}`;
  }

  protected simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  protected extractText(element: Element | null): string {
    if (!element) return '';
    return element.textContent?.trim() || '';
  }

  /**
   * 提取HTML内容（保留格式）
   * 清理不需要的属性和脚本，但保留基本格式
   */
  protected extractHtml(element: Element | null): string {
    if (!element) return '';
    
    // 克隆元素以避免修改原始DOM
    const clone = element.cloneNode(true) as Element;
    
    // 清理不需要的元素和属性
    this.cleanHtmlElement(clone);
    
    // 获取内部HTML
    return clone.innerHTML.trim();
  }

  /**
   * 清理HTML元素，移除脚本、事件处理器等，但保留格式
   */
  private cleanHtmlElement(element: Element): void {
    // 移除脚本和样式标签
    const scripts = element.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());
    
    // 移除事件处理器属性
    const attrsToRemove = [
      'onclick', 'onerror', 'onload', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
      'data-test-id', 'jslog', 'data-ved', 'data-hveid',
      'aria-describedby', 'cdk-describedby-host'
    ];
    
    // 清理当前元素的属性
    attrsToRemove.forEach(attr => {
      element.removeAttribute(attr);
    });
    
    // 清理所有子元素的属性
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      attrsToRemove.forEach(attr => {
        el.removeAttribute(attr);
      });
      
      // 移除Angular特定的属性
      const ngAttrs = Array.from(el.attributes)
        .filter(attr => attr.name.startsWith('_ng') || attr.name.startsWith('ng-'));
      ngAttrs.forEach(attr => el.removeAttribute(attr.name));
    });
    
    // 移除隐藏元素
    const hiddenElements = element.querySelectorAll('[style*="display: none"], [hidden], .cdk-visually-hidden');
    hiddenElements.forEach(el => el.remove());
  }
}
