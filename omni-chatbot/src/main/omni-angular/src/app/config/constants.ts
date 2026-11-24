/**
 * Application Constants
 * Centralized location for all application-wide constants
 */

/**
 * Query parameters to exclude from person attributes
 * These are system/internal parameters that should not be sent to the API
 */
export const EXCLUDED_QUERY_PARAMS = [
  'filename',    // System routing parameter
  'v',           // Version parameter
  'version',     // Version parameter
  'timestamp',   // Cache-busting parameter
  'cache',       // Cache control parameter
  '_'            // Common cache-busting parameter
] as const;

/**
 * PostMessage event types
 */
export const POST_MESSAGE_TYPES = {
  CHATBOT_ICON_CLICKED: 'chatbotIconClicked',
  DATA_TO_CHATBOT: 'dataToChatbot',
  UPSERT_PERSON_ATTRIBUTES: 'upsertPersonAttributes',
  INIT_DONE: 'initDone',
  SERVICE_UNAVAILABLE: 'serviceUnavailable'
} as const;
