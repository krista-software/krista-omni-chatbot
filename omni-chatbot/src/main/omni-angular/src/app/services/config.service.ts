import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InternalChatbotConfig } from '../models/chatbot.models';
import { createMediaUrlDownload, getStoredClientSessionId } from '../utils/media-url.util';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configSubject = new BehaviorSubject<InternalChatbotConfig>({
    workspaceId: 'default-workspace',
    nodeName: 'default-node',
    languages: [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' }
    ],
    defaultLanguage: 'en',
    theme: {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      backgroundColor: '#ffffff',
      textColor: '#333333',
      borderRadius: '8px'
    },
    botName: 'Krista',
    botIcon: '/assets/images/krista-icon.png',
    features: {
      enableFileUpload: true,
      enableVoiceInput: false,
      enableTypingIndicator: true,
      maxMessageLength: 1000
    },
    config: {
      botNamePosition: 'center',
      botName: 'Krista',
      botSubTitle: '',
      canChangeLanguage: false,
      hideSendMessage: false
    }
  });

  public config$ = this.configSubject.asObservable();

  constructor() {}

  initializeConfig(): void {
    // Initialize with default config
    // Set global window.workspaceId for media URL generation (matches original app)
    const currentConfig = this.configSubject.value;
    if (currentConfig?.workspaceId) {
      (window as any).workspaceId = currentConfig.workspaceId;
    }
  }

  getCurrentConfig(): InternalChatbotConfig {
    return this.configSubject.value;
  }

  updateConfig(config: Partial<InternalChatbotConfig>): void {
    const currentConfig = this.configSubject.value;

    // Handle API config format if it's from the API service
    if (config && typeof config === 'object' && 'workspaceId' in config) {
      const apiConfig = config as any;

      // Filter out default TnCLabel to allow translations to work
      // Only use TnCLabel if it's a custom value (not the default English text)
      let tnCLabel = apiConfig.config?.TnCLabel;
      if (tnCLabel === 'Terms & Conditions' || tnCLabel === 'Terms and Conditions') {
        tnCLabel = undefined; // Let the translation handle it
      }

      // When API returns empty config (e.g., { config: {} }), preserve all defaults.
      // Each property has an explicit fallback so null/undefined/empty values
      // from the API don't overwrite the defaults set in the BehaviorSubject.
      const apiCfg = apiConfig.config || {};

      // Map the supportedLanguages list from the GET /config response onto
      // InternalChatbotConfig.languages so loadSupportedLanguages() can skip the
      // GET /chatbot/supportedLanguages round-trip when the list is already present.
      const inlinedLanguages = Array.isArray(apiConfig.supportedLanguages)
        ? apiConfig.supportedLanguages
        : undefined;

      const mappedConfig: InternalChatbotConfig = {
        ...currentConfig,
        workspaceId: apiConfig.workspaceId || currentConfig.workspaceId || '',
        nodeName: apiConfig.nodeName || currentConfig.nodeName || '',
        botName: apiCfg.botName || currentConfig.botName || 'Krista',
        botIcon: apiConfig.icon || apiCfg.logo || currentConfig.botIcon || '',
        icon: apiConfig.icon || currentConfig.icon,
        languages: inlinedLanguages && inlinedLanguages.length > 0
          ? inlinedLanguages
          : currentConfig.languages,
        config: {
          ...currentConfig.config,
          ...apiCfg,
          botName: apiCfg.botName || currentConfig.config?.botName || 'Krista',
          botSubTitle: apiCfg.hasOwnProperty('botSubTitle') ? apiCfg.botSubTitle : (currentConfig.config?.botSubTitle ?? ''),
          botNamePosition: apiCfg.botNamePosition || currentConfig.config?.botNamePosition || 'center',
          canChangeLanguage: !!(apiCfg.canChangeLanguage && apiConfig.isMultilingualEnabled),
          TnC: apiCfg.TnC || '',
          TnCLabel: tnCLabel,
          isFullSize: apiCfg.isFullSize || currentConfig.config?.['isFullSize'] || false,
          hideSendMessage: apiCfg.hideSendMessage || currentConfig.config?.hideSendMessage || false,
          restartOnRefresh: apiCfg.restartOnRefresh || currentConfig.config?.['restartOnRefresh'] || false
        }
      };

      this.configSubject.next(mappedConfig);

      // Set global window.workspaceId for media URL generation (matches original app)
      if (mappedConfig.workspaceId) {
        (window as any).workspaceId = mappedConfig.workspaceId;
      }
    } else {
      // Regular partial config update
      const updatedConfig = { ...currentConfig, ...config };
      this.configSubject.next(updatedConfig);

      // Set global window.workspaceId for media URL generation (matches original app)
      if (updatedConfig.workspaceId) {
        (window as any).workspaceId = updatedConfig.workspaceId;
      }
    }
  }

  getConfig(): any {
    return this.configSubject.asObservable();
  }

  /**
   * Re-emits the current config without changing it, so subscribers re-derive
   * session-dependent values (e.g. the media-backed header icon) after login.
   */
  refresh(): void {
    this.configSubject.next(this.configSubject.value);
  }

  getChatbotIcon(): string {
    const currentConfig = this.configSubject.getValue();

    // Priority: config.logo > icon (mediaId) > default krista-icon.svg
    // Matches original app's useChatbotIcon hook logic
    if (currentConfig.config?.['logo']) {
      return currentConfig.config['logo'];
    }

    // The config carries the icon in one of the platform's encoded forms (see
    // kristaclient's Icon.ts). Only "icon:svg:<id>&mediaId=<mediaId>" and
    // "media:<mediaId>" are media-backed and must be resolved to a media-download
    // URL; every other form (icon:fontawesome/material/local, raw URL/SVG) is a
    // direct value and is returned verbatim.
    if (currentConfig.icon) {
      const mediaId = this.resolveIconMediaId(currentConfig.icon);
      if (mediaId) {
        // The media endpoint is auth'd via the clientSessionId query param, which
        // an <img> tag can't send as a header. Before login the session isn't
        // stored yet, so building the URL now would 401 — only build it once a
        // session exists. storeAuthenticationData() re-emits the config after login
        // (refresh()), which re-runs this with a valid session.
        if (getStoredClientSessionId()) {
          const url = createMediaUrlDownload(currentConfig.workspaceId, mediaId);
          if (url) {
            return url;
          }
        }
      } else {
        // Non-media icon (font/local/raw): use as-is, matching Icon.ts's url branch.
        return currentConfig.icon;
      }
    }

    // Default to krista-icon.svg (matches original app behavior)
    return '/assets/images/krista-icon.svg';
  }

  /**
   * Resolves the media id from a config icon string, mirroring kristaclient's
   * Icon.ts. Returns '' when the icon is NOT media-backed:
   *   - "icon:svg:<iconId>&mediaId=<mediaId>" -> media id is the part after "mediaId="
   *   - "media:<mediaId>" (anything containing "media") -> strip the "media:" prefix
   *   - otherwise (icon:fontawesome/material/local, raw URL/SVG) -> '' (not media)
   * Without this, the "icon:svg:...&mediaId=..." form was passed verbatim as the
   * media id, producing a broken .../media/workspaces/<ws>/icon:svg:...&mediaId=... URL.
   */
  private resolveIconMediaId(icon: string): string {
    if (icon.startsWith('icon:svg')) {
      return icon.split('&').pop()!.split('=').pop()!;
    }
    if (icon.includes('media')) {
      return icon.replace('media:', '');
    }
    return '';
  }

  // Callback for WebSocket events (matches original app pattern)
  private toolkitCallback: ((event: string, payload?: any) => void) | null = null;

  /**
   * Set the callback for WebSocket events (matches original app toolkit.init callback)
   */
  setToolkitCallback(callback: (event: string, payload?: any) => void): void {
    this.toolkitCallback = callback;
  }

  getToolkitConfig(): any {
    return {
      workspaceId: this.configSubject.value.workspaceId,
      nodeName: this.configSubject.value.nodeName,
      callback: this.toolkitCallback
    };
  }
}
