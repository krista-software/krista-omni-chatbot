/**
 * HTTP Interceptors barrel export
 */
export { AuthInterceptor } from './auth.interceptor';
export { ErrorInterceptor } from './error.interceptor';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { ErrorInterceptor } from './error.interceptor';

/**
 * Provider array for registering all HTTP interceptors
 * Import this in your app.module.ts or core.module.ts
 * 
 * Usage:
 * ```typescript
 * import { httpInterceptorProviders } from './core/interceptors';
 * 
 * @NgModule({
 *   providers: [
 *     ...httpInterceptorProviders
 *   ]
 * })
 * export class AppModule { }
 * ```
 */
export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
];

