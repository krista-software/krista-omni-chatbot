import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

// HTTP Interceptors
import { httpInterceptorProviders } from './interceptors';

/**
 * Core Module
 * 
 * This module contains singleton services and providers that should only be
 * instantiated once in the application. It follows Angular best practices
 * for organizing core functionality.
 * 
 * Contents:
 * - HTTP Interceptors (Auth, Error handling)
 * - Singleton services (to be migrated here)
 * - Guards (future)
 * 
 * Usage:
 * Import CoreModule ONLY in AppModule. The constructor guard prevents
 * accidental re-import in lazy-loaded modules.
 * 
 * ```typescript
 * @NgModule({
 *   imports: [CoreModule]
 * })
 * export class AppModule { }
 * ```
 */
@NgModule({
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    // HTTP Interceptors
    ...httpInterceptorProviders
    
    // Note: Services with providedIn: 'root' don't need to be listed here
    // They are automatically singleton and tree-shakeable
    
    // Future: Add guards, resolvers, and other singleton providers here
  ]
})
export class CoreModule {
  /**
   * Guard against re-importing CoreModule
   * CoreModule should only be imported in AppModule
   */
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error(
        'CoreModule is already loaded. Import it in the AppModule only.'
      );
    }
  }
}

