import { Injectable } from '@angular/core';

/**
 * Language configuration stored in localStorage
 */
export interface StoredLanguage {
  name: string;
  code: string;
  flag?: string;
}

/**
 * Authentication data stored in localStorage
 */
export interface StoredAuthData {
  accountId?: string;
  clientSessionId?: string;
  kristaAccountId?: string;
  personId?: string;
  name?: string;
  extras?: {
    newSession?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STORAGE_PREFIX = 'krista_chatbot_';

  constructor() {
    this.purgeLegacyReactKeys();
  }

  /**
   * One-time cleanup: the pre-Angular React chatbot persisted device-scoped
   * data under 'pref/device/*' (device_... ids, JWT login details, etc.).
   * Nothing reads those keys anymore — the last consumer, the media-url
   * clientSessionId fallback, is gone — so purge them to stop long-time
   * users' storage from carrying dead data.
   */
  private purgeLegacyReactKeys(): void {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('pref/device/'))
        .forEach(key => localStorage.removeItem(key));
    } catch {
      // Storage unavailable - nothing to purge
    }
  }

  // Generic storage methods
  setItem<T>(key: string, value: T): void {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(this.STORAGE_PREFIX + key, serializedValue);
    } catch {
      // Storage error - ignore
    }
  }

  getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(this.STORAGE_PREFIX + key);
      if (item === null) {
        return defaultValue ?? null;
      }
      return JSON.parse(item) as T;
    } catch {
      return defaultValue ?? null;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(this.STORAGE_PREFIX + key);
  }

  // Specific methods for chatbot data
  getSelectedLanguage(): string | null {
    return this.getItem<string>('selectedLanguage', 'en');
  }

  setSelectedLanguage(language: string): void {
    this.setItem('selectedLanguage', language);
  }

  getClientSessionId(): string | null {
    return this.getItem<string>('clientSessionId');
  }

  setClientSessionId(sessionId: string): void {
    this.setItem('clientSessionId', sessionId);
  }

  clearClientSessionId(): void {
    this.removeItem('clientSessionId');
  }

  getMyContactId(): string | null {
    return this.getItem<string>('myContactId');
  }

  setMyContactId(contactId: string): void {
    this.setItem('myContactId', contactId);
  }

  getName(): string | null {
    return this.getItem<string>('name');
  }

  setName(name: string): void {
    this.setItem('name', name);
  }

  getWorkspaceId(): string | null {
    return this.getItem<string>('workspaceId');
  }

  setWorkspaceId(workspaceId: string): void {
    this.setItem('workspaceId', workspaceId);
  }

  // Supported Languages Cache - persists across session restarts
  getSupportedLanguages(): StoredLanguage[] | null {
    return this.getItem<StoredLanguage[]>('supportedLanguages');
  }

  setSupportedLanguages(languages: StoredLanguage[]): void {
    this.setItem('supportedLanguages', languages);
  }

  getLoggedInDetails(): StoredAuthData | null {
    return this.getItem<StoredAuthData>('loggedInDetails');
  }

  setLoggedInDetails(authData: StoredAuthData): void {
    this.setItem('loggedInDetails', authData);
  }

  // Deliberately preserves 'selectedLanguage': it's a browser-user UI preference,
  // not session state. Clearing it here silently reset the language to 'en' after
  // a session timeout or restartOnRefresh logout (Start Over used to work around
  // it by re-saving the language after logout).
  logOut(): void {
    this.removeItem('loggedInDetails');
    this.removeItem('clientSessionId');
  }
}
