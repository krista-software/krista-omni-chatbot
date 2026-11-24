/**
 * Application Configuration
 * Centralized configuration for the Angular chatbot app
 */

import devConfig from '../../dev-config.json';

// Extend Window interface to include basePath + cdnCacheVersion
declare global {
  interface Window {
    basePath?: string;
    cdnCacheVersion?: string;
  }
}

export const AppConfig = {
  /**
   * Fallback Chatbot Routing ID for localhost development only.
   * Sourced from src/dev-config.json (the single file to edit for local dev).
   * In production, the routing ID is extracted from window.basePath, so this
   * value is never used there.
   */
  _fallbackRoutingId: devConfig.routingId,

  /**
   * Get the base path - uses window.basePath directly in production (preserves /v1/ etc.)
   * Falls back to constructing from the dev routing ID for localhost.
   */
  getBasePath(): string {
    if (typeof window !== 'undefined' && window.basePath && window.basePath !== '__chatbotBasePath__') {
      return window.basePath;
    }
    return `/extension/api/${this._fallbackRoutingId}/`;
  },

  /**
   * Get the full chatbot routing path
   */
  getChatbotRoutingPath(): string {
    return this.getBasePath();
  },

  /**
   * Resolve the CDN cache version injected into index.html (window.cdnCacheVersion,
   * replaced server-side). Falls back to '0' for localhost dev, where the placeholder
   * is not replaced. Used to build versioned, CDN-cacheable resource URLs (e.g. /config,
   * /supportedLanguages) so a deploy's version bump busts the CDN cache.
   */
  getCdnCacheVersion(): string {
    const version = typeof window !== 'undefined' ? window.cdnCacheVersion : undefined;
    return version && version !== '__cdnCacheVersion__' ? version : '0';
  },

  /**
   * Get the WebSocket URL for the given host
   */
  getWebSocketUrl(host: string = 'localhost:4200'): string {
    const protocol = host.includes('localhost') ? 'ws' : 'wss';
    return `${protocol}://${host}${this.getBasePath()}ws`;
  }
};
