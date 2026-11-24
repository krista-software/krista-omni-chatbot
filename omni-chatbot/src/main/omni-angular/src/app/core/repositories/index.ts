/**
 * Repositories barrel export
 * 
 * Repository Pattern implementation for data access layer.
 * Repositories handle all API communication and data transformation.
 */

export { BaseApiRepository } from './base-api.repository';
export { MessageRepository } from './message.repository';
export type { MessagesResponse, GetMessagesOptions } from './message.repository';

