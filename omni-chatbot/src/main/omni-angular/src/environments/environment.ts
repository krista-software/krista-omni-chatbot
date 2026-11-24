import { AppConfig } from '../app/config/app.config';

export const environment = {
  production: false,
  // Use empty strings for dev - Angular dev server proxy will handle routing
  apiHost: '',
  chatbotHost: '',
  chatbotRoutingId: AppConfig.getChatbotRoutingPath(),
  mediaHost: '',
  // WebSocket URL will use current window.location.host (Angular dev server will proxy)
  websocketUrl: '', // Will be constructed dynamically in the service

  // API Endpoints
  apiEndpoints: {
    getConfiguration: 'chatbot/config',
    getSession: 'chatbot/session',
    getSupportedLanguages: 'chatbot/supportedLanguages',
    login: 'chatbot/authn/login',
    logout: 'chatbot/authn/v1/logout',
    personAttributes: 'chatbot/authn/upsertPersonAttributes',
    getMessages: 'chatbot/inboxes/<inboxId>/messages',
    submitMessage: 'chatbot/inboxes/<inboxId>/messages/<messageId>',
    searchEntities: 'chatbot/entities/search'
  }
};
