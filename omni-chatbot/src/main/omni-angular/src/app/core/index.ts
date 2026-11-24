/**
 * Core Module barrel export
 *
 * This file exports all public APIs from the core module
 */

// Core Module
export { CoreModule } from './core.module';

// Interceptors
export { AuthInterceptor, ErrorInterceptor, httpInterceptorProviders } from './interceptors';

// Repositories
export { BaseApiRepository, MessageRepository } from './repositories';
export type { MessagesResponse, GetMessagesOptions } from './repositories';

// Facades
export { FormFacade } from './facades';

// State Management
export { ChatStateService } from './state';
export type { ChatState } from './state';

