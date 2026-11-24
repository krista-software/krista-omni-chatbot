import { NgModule, APP_INITIALIZER, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { APP_BASE_HREF } from '@angular/common';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { CustomTranslateLoader } from './services/custom-translate-loader';

// HTTP Interceptors
import { httpInterceptorProviders } from './core/interceptors';

// Feature Modules
import { SharedModule } from './shared/shared.module';
import { ChatModule } from './components/chat/chat.module';

// App Component
import { AppComponent } from './app.component';
import { ChatViewComponent } from './components/chat-view/chat-view.component';

// Services - Only import services needed for APP_INITIALIZER
// All services use providedIn: 'root' so they don't need to be in providers array
import { TranslationService } from './services/translation.service';
import { ConfigApiService } from './services/config-api.service';
import { setGlobalTranslateService } from './models/validators/field-validator.interface';
import { TranslateService } from '@ngx-translate/core';

/**
 * Factory function for CustomTranslateLoader
 * Injects APP_BASE_HREF to construct correct translation file paths
 */
export function createTranslateLoader(http: HttpClient, baseHref: string) {
  return new CustomTranslateLoader(http, baseHref);
}

/**
 * Factory function for APP_INITIALIZER
 * Ensures translations are loaded before the app starts
 * Also sets up the global TranslateService for validators
 */
export function initializeTranslations(
  translationService: TranslationService,
  translateService: TranslateService
): () => Promise<void> {
  return () => {
    // Set global TranslateService for validators
    setGlobalTranslateService(translateService);
    // Initialize translations
    return translationService.initialize();
  };
}

/**
 * Factory function for APP_INITIALIZER that kicks off the /chatbot/config
 * fetch in parallel with translation loading during Angular bootstrap.
 *
 * <p>Without this, the config request was triggered later from
 * AppFacade.initializeAPIs() (after bootstrap) and serially blocked the auth
 * chain — adding ~1.2s on top of the translation load. By starting it as an
 * APP_INITIALIZER alongside initializeTranslations, both run concurrently
 * and the slower of the two (config) determines the bootstrap delay.
 *
 * <p>ConfigApiService caches the result in a ReplaySubject, so the existing
 * AppFacade.initializeAPIs() subscribe gets the cached value immediately
 * (no duplicate fetch).
 */
export function initializeConfigPrefetch(
  configApiService: ConfigApiService
): () => Promise<void> {
  return () => configApiService.prefetchConfig();
}

/**
 * AppModule
 * Root module that bootstraps the application.
 *
 * Module Structure:
 * - SharedModule: Pipes, common components (LoadingComponent, NewTableComponent)
 * - FieldsModule: All 18+ field components for form rendering
 * - ChatModule: Chat-specific components (Header, Footer, Timeline, MessageBubble)
 */
@NgModule({
  declarations: [
    AppComponent,
    ChatViewComponent,
  ],
  imports: [
    // Angular Core Modules
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    // Match original app routing pattern:
    // Routing: redirect to /chat and guard the chat route
    // Angular: Redirect to /chat and use ChatViewComponent as route target
    RouterModule.forRoot([
      { path: '', redirectTo: '/chat', pathMatch: 'full' },
      { path: 'chat', component: ChatViewComponent }
    ]),

    // Translation Module
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient, APP_BASE_HREF]
      }
    }),

    // Feature Modules
    SharedModule,
    ChatModule,
  ],
  providers: [
    // HTTP Interceptors (Auth headers, Error handling)
    ...httpInterceptorProviders,

    // NOTE: All application services use providedIn: 'root' and are tree-shakeable.
    // They don't need to be listed here. Only special providers are needed:

    // Initialize translations before app starts
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslations,
      deps: [TranslationService, TranslateService],
      multi: true
    },
    // Prefetch /chatbot/config in parallel with translation init. Angular
    // runs all APP_INITIALIZER factories concurrently and bootstraps after
    // Promise.all resolves — so this fetch overlaps with translation load
    // instead of running serially after bootstrap.
    {
      provide: APP_INITIALIZER,
      useFactory: initializeConfigPrefetch,
      deps: [ConfigApiService],
      multi: true
    },
    // APP_BASE_HREF = window.basePath + "chatbot/{cdnCacheVersion}/ui/"
    // Version comes from window.cdnCacheVersion (set in index.html, replaced at serve-time)
    {
      provide: APP_BASE_HREF,
      useFactory: () => {
        const basePath = (window as any).basePath;
        if (basePath && basePath !== '__chatbotBasePath__') {
          const cdnVersion = (window as any).cdnCacheVersion;
          const version = cdnVersion && cdnVersion !== '__cdnCacheVersion__' ? cdnVersion : '0';
          return basePath + 'chatbot/' + version + '/ui/';
        }
        return '/';
      }
    }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule { }
