export interface Language {
  name: string;
  code: string;
  flag?: string;
}

export interface CustomThemeColors {
  brandColor: string;
  textColor: string;
  dividerColor: string;
  fontFamily?: string;
  fontImportUrl?: string;
}

export interface ChatbotConfig {
  workspaceId: string;
  nodeName: string;
  kristaAccountId: string;
  icon?: string;
  isMultilingualEnabled: boolean;
  // Inlined supported-languages list — populated by the BE alongside
  // isMultilingualEnabled so the FE can render the language picker without
  // a separate GET /chatbot/supportedLanguages round-trip on every page load.
  supportedLanguages?: Language[];
  config: {
    botName?: string;
    botSubTitle?: string;
    welcomeMessage?: string;
    TnC?: string;
    TnCLabel?: string;
    outlineColor?: string;
    outlineWidth?: string;
    logo?: string;
    canChangeLanguage?: boolean;
    botNamePosition?: 'center' | 'left' | 'right';
    theme?: CustomThemeColors;
    isFullSize?: boolean;
    restartOnRefresh?: boolean;
    hideSendMessage?: boolean;
    // Admin-configurable concurrency-control keys (surfaced verbatim from the
    // uiConfigJson map — any absent key means the feature is disabled/defaulted)
    concurrencyControlEnabled?: boolean;
    maxConcurrentUsers?: number;
    idleDisconnectSeconds?: number;
    // Allow arbitrary admin-set keys without breaking the type on every add
    [key: string]: any;
  };
  _apiStatus_?: string;
  _error_?: any;
}

export interface UserData {
  accountId: string;
  name: string;
  extras?: {
    newSession?: boolean;
    [key: string]: unknown;
  };
}
