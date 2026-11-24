import { AppConfig } from '../app/config/app.config';

export const environment = {
  production: true,
  // Use empty hosts so URLs stay relative and can be transformed by generateFinalAPIURL
  // When hostname is extension.qa-in.eng.krista.app, it transforms to qa-in.eng.krista.app
  // This matches original app's pattern where base href handles routing and generateFinalAPIUrl transforms
  apiHost: '',
  chatbotHost: '',
  chatbotRoutingId: AppConfig.getChatbotRoutingPath(),
  mediaHost: '',
  websocketUrl: AppConfig.getWebSocketUrl(window.location.hostname),

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
