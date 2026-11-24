/**
 * API Endpoints Configuration
 *
 * Centralized configuration for all API endpoints used in the application.
 * This provides type safety and helper functions for URL generation.
 *
 * Benefits:
 * - Single source of truth for all API endpoints
 * - Type-safe endpoint access
 * - Helper functions for parameterized URLs
 * - Easy to update endpoints across the application
 */

/**
 * API Endpoint templates
 * Use <paramName> syntax for path parameters
 */
export const API_ENDPOINTS = {
  // Configuration endpoints
  CONFIG: {
    GET: 'chatbot/config',
    UPDATE: 'chatbot/config'
  },

  // Session endpoints
  SESSION: {
    GET: 'chatbot/session'
  },

  // Authentication endpoints
  AUTH: {
    LOGOUT: 'authn/v1/logout',
    UPSERT_PERSON_ATTRIBUTES: 'authn/upsertPersonAttributes'
  },

  // Language endpoints
  LANGUAGES: {
    GET_SUPPORTED: 'chatbot/supportedLanguages'
  },

  // Account/Workspace endpoints
  ACCOUNT: {
    GET_WORKSPACE_CONTACT: 'account/<accountId>'
  },

  // Message endpoints
  MESSAGES: {
    GET_ALL: 'chatbot/inboxes/<inboxId>/messages',
    GET_BY_ID: 'chatbot/inboxes/<inboxId>/messages/<messageId>',
    SUBMIT: 'chatbot/inboxes/<inboxId>/messages/<messageId>',
    DELETE: 'chatbot/inboxes/<inboxId>/messages/<messageId>'
  },

  // Media endpoints
  MEDIA: {
    UPLOAD: 'chatbot/media/upload',
    DOWNLOAD: 'chatbot/media/<mediaId>'
  },

  // Entity search endpoints
  ENTITY: {
    SEARCH: 'chatbot/entity/<entityType>/search'
  }
} as const;
