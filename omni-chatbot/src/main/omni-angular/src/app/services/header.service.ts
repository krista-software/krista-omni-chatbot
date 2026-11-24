import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthApiService } from './auth-api.service';
import { StorageService } from './storage.service';

export interface Language {
  code: string;
  name: string;
  flag?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HeaderService {
  private languagesSubject = new BehaviorSubject<Language[]>([]);
  private selectedLanguageSubject: BehaviorSubject<string>;

  public languages$ = this.languagesSubject.asObservable();
  public selectedLanguage$: Observable<string>;

  constructor(
    private authApiService: AuthApiService,
    private storageService: StorageService
  ) {
    // Initialize selected language from storage (matches original app: PrefStorage.getSelectedLanguage())
    const savedLanguage = this.storageService.getSelectedLanguage() || 'en';
    this.selectedLanguageSubject = new BehaviorSubject<string>(savedLanguage);
    this.selectedLanguage$ = this.selectedLanguageSubject.asObservable();

    // Initialize languages from localStorage cache (persists across session restarts)
    const cachedLanguages = this.storageService.getSupportedLanguages();
    if (cachedLanguages && cachedLanguages.length > 0) {
      this.languagesSubject.next(cachedLanguages);
    }
  }

  getLanguages(): Observable<Language[]> {
    return this.languages$;
  }

  setLanguages(languages: Language[]): void {
    this.languagesSubject.next(languages);
  }

  getSelectedLanguage(): string {
    return this.selectedLanguageSubject.value;
  }

  setSelectedLanguage(languageCode: string): void {
    this.selectedLanguageSubject.next(languageCode);
  }

  /**
   * Logout - calls the actual logout API (matches original app behavior)
   * Called when user clicks the refresh/restart button in header
   */
  logout(): Observable<void> {
    return this.authApiService.logout().pipe(
      catchError((error) => {
        // Continue even if logout fails - page will still refresh
        return of(undefined);
      })
    );
  }
}
