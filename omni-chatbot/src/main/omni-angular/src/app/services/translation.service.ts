import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';

/**
 * Translation interpolation parameters
 */
export type TranslationParams = Record<string, string | number | boolean>;

/**
 * Translation result from TranslateService
 */
type TranslationResult = string | Record<string, unknown>;

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private defaultLanguage = 'en';

  constructor(
    private translate: TranslateService,
    private storageService: StorageService
  ) {
    // Set default language
    this.translate.setDefaultLang(this.defaultLanguage);
  }

  /**
   * Initialize translations - called by APP_INITIALIZER
   * Returns a Promise that resolves when translations are loaded
   */
  initialize(): Promise<void> {
    // Get saved language from storage or use default
    const savedLanguage = this.storageService.getSelectedLanguage() || this.defaultLanguage;

    // Use the language
    return firstValueFrom(this.translate.use(savedLanguage))
      .catch(() => {
        // Fallback to default language
        return firstValueFrom(this.translate.use(this.defaultLanguage));
      })
      .then(() => {
        // Ensure promise resolves to void
      });
  }

  /**
   * Change the current language
   */
  changeLanguage(languageCode: string): Observable<TranslationResult> {
    this.storageService.setSelectedLanguage(languageCode);
    return this.translate.use(languageCode);
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.translate.currentLang || this.defaultLanguage;
  }

  /**
   * Get instant translation
   */
  instant(key: string, params?: TranslationParams): string {
    return this.translate.instant(key, params);
  }

  /**
   * Get translation as observable
   */
  get(key: string, params?: TranslationParams): Observable<string> {
    return this.translate.get(key, params);
  }
}

