// Configuration Types
/**
 * Internal application configuration model.
 * This is different from ChatbotConfig in config.model.ts which represents the API response.
 * @deprecated Use ChatbotConfig from config.model.ts for API responses.
 * This interface is kept for backward compatibility with existing components.
 */
export interface InternalChatbotConfig {
  workspaceId: string;
  nodeName: string;
  languages: Language[];
  defaultLanguage: string;
  theme: ThemeConfig;
  botName: string;
  botIcon: string;
  icon?: string;
  features: FeatureConfig;
  config: {
    botNamePosition?: string;
    botName?: string;
    botSubTitle?: string;
    canChangeLanguage?: boolean;
    hideSendMessage?: boolean;
    TnC?: string;
    TnCLabel?: string;
    [key: string]: any;
  };
}

// Re-export ChatbotConfig from config.model.ts as the canonical source
export type { ChatbotConfig } from './config.model';

export interface Language {
  code: string;
  name: string;
  flag?: string;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
}

export interface FeatureConfig {
  enableFileUpload: boolean;
  enableVoiceInput: boolean;
  enableTypingIndicator: boolean;
  maxMessageLength: number;
}

// User Types
export interface UserData {
  accountId: string;
  name: string;
  email?: string;
  sessionId?: string;
  language?: string;
}
