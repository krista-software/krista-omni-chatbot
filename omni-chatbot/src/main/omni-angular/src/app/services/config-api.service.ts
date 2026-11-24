import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, ReplaySubject, firstValueFrom } from 'rxjs';
import { map, catchError, finalize, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoadingService } from './loading.service';
import { StorageService } from './storage.service';
import { environment } from '../../environments/environment';
import { AppConfig } from '../config/app.config';
import { ChatbotConfig, Language, CustomThemeColors } from '../models/config.model';

// Re-export for backward compatibility
export type { ChatbotConfig, Language, CustomThemeColors } from '../models/config.model';

export interface WorkspaceContact {
  accountId: string;
  workspaceId: string;
  contactId: string;
  [key: string]: unknown;
}

/**
 * API response wrapper for configuration
 */
interface ConfigApiResponse {
  data?: ChatbotConfig;
  workspaceId?: string;
}

/**
 * API response wrapper for languages
 */
interface LanguagesApiResponse {
  data?: Language[];
  languages?: Language[];
}

/**
 * Raw language from API
 */
interface RawLanguage {
  name?: string;
  label?: string;
  code?: string;
  value?: string;
  flag?: string;
}

/**
 * API response wrapper for workspace contact
 */
interface WorkspaceContactApiResponse {
  data: WorkspaceContact;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigApiService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Caches the most recent /chatbot/config response and replays it to every
  // subscriber. Populated once by whichever of prefetchConfig() (from the
  // APP_INITIALIZER) or getConfiguration() (from AppFacade.initializeAPIs)
  // runs first; the other call gets the cached value immediately.
  private cachedConfig$ = new ReplaySubject<ChatbotConfig>(1);
  private fetchStarted = false;

  constructor(
    private apiService: ApiService,
    private loadingService: LoadingService,
    private storageService: StorageService
  ) {}

  /**
   * Kicks off the configuration fetch immediately and returns a Promise that
   * resolves once the response is in the cache. Designed for use as an
   * APP_INITIALIZER factory so the config request runs in parallel with the
   * translation file load during Angular bootstrap (saves ~700ms of serial
   * wait before auth can start).
   *
   * <p>Idempotent — subsequent calls return a Promise tied to the same
   * already-in-flight (or completed) fetch.
   */
  prefetchConfig(): Promise<void> {
    this.startFetchIfNeeded();
    return firstValueFrom(this.cachedConfig$).then(() => undefined);
  }

  /**
   * Get chatbot configuration - matches original app implementation
   * GET /chatbot/config
   *
   * <p>If {@link #prefetchConfig()} has already been called (typically from
   * the APP_INITIALIZER), the cached value is replayed immediately and no
   * new HTTP request is made. Otherwise the fetch is triggered now.
   */
  getConfiguration(): Observable<ChatbotConfig> {
    this.startFetchIfNeeded();
    return this.cachedConfig$.asObservable();
  }

  /**
   * Inserts the CDN cache version into a chatbot endpoint path
   * ('chatbot/config' -> 'chatbot/{version}/config') so the request targets the
   * versioned, CDN-cacheable URL. The server's CdnCacheVersionFilter strips the
   * version prefix back off, so backend routing is unchanged.
   */
  private toVersionedEndpoint(endpoint: string): string {
    return endpoint.replace(/^chatbot\//, `chatbot/${AppConfig.getCdnCacheVersion()}/`);
  }

  /**
   * True when the app runs inside the Integration Settings live preview:
   * launcher-core appends chatbotPreview=1 to the iframe URL. In preview mode
   * the config is fetched from /chatbot/preview-config (Cache-Control:
   * no-store — never cached by browser or CDN), so just-saved admin settings
   * always show. Customer embeds keep the cached, versioned /config.
   *
   * The chatbotPreview=1 query param is only on the INITIAL iframe URL. Angular
   * routing to /chat drops the query string, and the header Restart button then
   * navigates to that param-less URL (window.location.href = .../ui/), so a
   * naive query-only check made the restarted app fall back to the cached
   * versioned /config. We therefore latch the flag in sessionStorage on first
   * detection — scoped to this preview iframe's browsing context (a customer
   * embed is a different context and never sets it) — and honour it on every
   * later fetch, including after Restart.
   */
  private isPreviewMode(): boolean {
    if (new URLSearchParams(window.location.search).get('chatbotPreview') === '1') {
      try { sessionStorage.setItem('chatbotPreviewMode', '1'); } catch { /* storage may be blocked */ }
      return true;
    }
    try {
      return sessionStorage.getItem('chatbotPreviewMode') === '1';
    } catch {
      return false;
    }
  }

  private startFetchIfNeeded(): void {
    if (this.fetchStarted) {
      return;
    }
    this.fetchStarted = true;

    // Start loading
    this.loadingSubject.next(true);
    this.loadingService.setConfigLoading(true, 'Loading configuration...');

    const configEndpoint = this.isPreviewMode()
      ? environment.apiEndpoints.getConfiguration.replace(/\/config$/, '/preview-config')
      : this.toVersionedEndpoint(environment.apiEndpoints.getConfiguration);

    this.apiService.getPublic<ChatbotConfig | ConfigApiResponse>(configEndpoint).pipe(
      map((response: ChatbotConfig | ConfigApiResponse) => {
        // Handle different response formats
        let config: ChatbotConfig;

        if ('workspaceId' in response && response.workspaceId) {
          config = response as ChatbotConfig;
        } else if ('data' in response && response.data) {
          config = response.data;
        } else {
          // Fallback configuration
          config = {
            workspaceId: '',
            nodeName: 'Chatbot',
            kristaAccountId: '',
            isMultilingualEnabled: false,
            config: {
              botName: 'Krista Assistant',
              botSubTitle: 'How can I help you today?',
              botNamePosition: 'center',
              canChangeLanguage: false,
              hideSendMessage: false,
              restartOnRefresh: false,
              isFullSize: false
            }
          };
        }

        // Set API status
        config._apiStatus_ = 'success';

        return config;
      }),
      catchError((error: Error) => {
        // Return fallback configuration with error status
        const fallbackConfig: ChatbotConfig = {
          workspaceId: '',
          nodeName: 'Chatbot',
          kristaAccountId: '',
          isMultilingualEnabled: false,
          config: {
            botName: 'Krista',
            botSubTitle: '',
            botNamePosition: 'center',
            canChangeLanguage: false,
            hideSendMessage: false,
            restartOnRefresh: false,
            isFullSize: false
          },
          _apiStatus_: 'error',
          _error_: error
        };

        return of(fallbackConfig);
      }),
      finalize(() => {
        // Stop loading
        this.loadingSubject.next(false);
        this.loadingService.setConfigLoading(false);
      })
    ).subscribe(config => {
      // Push the resolved config into the replay subject. Every getConfiguration()
      // / prefetchConfig() caller — including ones that subscribed before this
      // arrives — receives this value.
      this.cachedConfig$.next(config);
    });
  }

  /**
   * Get supported languages - Always calls API first, falls back to cache on failure
   * GET /chatbot/supportedLanguages
   *
   * Strategy:
   * 1. Always call the API first to get fresh data
   * 2. If API succeeds: cache the result and return it
   * 3. If API fails: fall back to cached data if available
   * 4. If no cache: return default English language
   */
  getSupportedLanguages(): Observable<Language[]> {
    // Always fetch from API first
    return this.apiService.getPublic<Language[] | LanguagesApiResponse>(this.toVersionedEndpoint(environment.apiEndpoints.getSupportedLanguages)).pipe(
      map((response: Language[] | LanguagesApiResponse) => {
        let languages: RawLanguage[] = [];

        if (Array.isArray(response)) {
          languages = response;
        } else if (response?.data && Array.isArray(response.data)) {
          languages = response.data;
        } else if (response?.languages && Array.isArray(response.languages)) {
          languages = response.languages;
        }

        // Ensure each language has required properties
        return languages.map((lang: RawLanguage): Language => ({
          name: lang.name || lang.label || lang.code || '',
          code: lang.code || lang.value || '',
          flag: lang.flag
        }));
      }),
      tap((languages: Language[]) => {
        // Cache in localStorage (persists across session restarts)
        this.storageService.setSupportedLanguages(languages);
      }),
      catchError(() => {
        // Fall back to cached languages if available
        const cachedLanguages = this.storageService.getSupportedLanguages();
        if (cachedLanguages && cachedLanguages.length > 0) {
          return of(cachedLanguages);
        }

        // No cache available - return default English language
        const defaultLanguages: Language[] = [
          { name: 'English', code: 'en', flag: 'us' }
        ];

        // Cache the default languages in localStorage
        this.storageService.setSupportedLanguages(defaultLanguages);

        return of(defaultLanguages);
      })
    );
  }
}
