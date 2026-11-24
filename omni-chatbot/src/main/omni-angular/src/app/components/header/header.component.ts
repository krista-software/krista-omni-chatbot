import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { HeaderService, Language } from '../../services/header.service';
import { ConfigService } from '../../services/config.service';
import { StorageService } from '../../services/storage.service';
import { TranslationService } from '../../services/translation.service';
import { InternalChatbotConfig } from '../../models/chatbot.models';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isReloading = false;
  chatbotConfig: InternalChatbotConfig;
  botNamePosition: string = 'center';
  chatbotIcon: string = '';
  isInitialized = false;

  // Language selector properties (matches original app: Header.tsx)
  languages: Language[] = [];
  selectedLanguage: string = 'en';
  canChangeLanguage: boolean = false;

  constructor(
    private headerService: HeaderService,
    private configService: ConfigService,
    private storageService: StorageService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize immediately in constructor to prevent flickering
    this.chatbotConfig = this.configService.getCurrentConfig();
    this.botNamePosition = this.chatbotConfig.config.botNamePosition || 'center';
    this.chatbotIcon = this.configService.getChatbotIcon();
    this.canChangeLanguage = this.chatbotConfig.config.canChangeLanguage || false;
    this.selectedLanguage = this.storageService.getSelectedLanguage() || 'en';

    // Load cached languages from localStorage immediately (persists across session restarts)
    const cachedLanguages = this.storageService.getSupportedLanguages();
    if (cachedLanguages && cachedLanguages.length > 0) {
      this.languages = cachedLanguages;
    }

    this.isInitialized = true;
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    // Subscribe to config changes (but data is already initialized in constructor)
    this.configService.getConfig()
      .pipe(takeUntil(this.destroy$))
      .subscribe((config: InternalChatbotConfig) => {
        this.chatbotConfig = config;
        this.botNamePosition = config.config.botNamePosition || 'center';
        this.chatbotIcon = this.configService.getChatbotIcon();
        this.canChangeLanguage = config.config.canChangeLanguage || false;
        this.cdr.markForCheck();
      });

    // Subscribe to languages from header service (matches original app: Header.tsx fetchLanguages)
    this.headerService.languages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((languages: Language[]) => {
        this.languages = languages;
        this.cdr.markForCheck();
      });

    // Subscribe to selected language changes
    this.headerService.selectedLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((languageCode: string) => {
        this.selectedLanguage = languageCode;
        this.cdr.markForCheck();
      });
  }

  /**
   * Handle language change (matches original app: Header.tsx onLanguageChange)
   * Saves language to storage, changes i18n language, and restarts session
   */
  onLanguageChange(languageCode: string): void {
    // Save language to storage (matches original app: PrefStorage.setSelectedLanguage)
    this.storageService.setSelectedLanguage(languageCode);
    this.headerService.setSelectedLanguage(languageCode);

    // Change i18n language (matches original app: i18n.changeLanguage)
    this.translationService.changeLanguage(languageCode).subscribe(() => {
      // Restart session to apply new language (matches original app: onClickStartOver)
      this.onClickStartOver();
    });
  }

  onClickStartOver(): void {
    this.isReloading = true;
    this.cdr.markForCheck();

    // selectedLanguage survives logout (StorageService.logOut preserves it),
    // so no capture/restore dance is needed here anymore.
    this.headerService.logout().subscribe(() => {
      const currentUrl = window.location.href;

      if (currentUrl.endsWith('/chat')) {
        // Remove 'chat' (4 characters) from the end, leaving the trailing '/'
        // This matches original app: currentUrl.slice(0, -'chat'.length)
        const newUrl = currentUrl.slice(0, -4);
        const message = { messageType: "restartOnRefresh" };
        if (window.parent) {
          window.parent.postMessage(JSON.stringify(message), "*");
        }
        window.location.href = newUrl;
        this.isReloading = false;
      } else {
        window.location.reload();
      }
    });
  }

  onCloseClick(): void {
    if (window.parent) {
      window.parent.postMessage('{"messageType": "minimize", "value":true}', "*");
    }
  }

  get botName(): string {
    return this.chatbotConfig?.config.botName || 'Krista';
  }

  get botSubTitle(): string {
    return this.chatbotConfig?.config.botSubTitle || '';
  }

  onImageError(event: any): void {
    // Fallback to Krista logo if the current icon fails to load
    event.target.src = '/assets/images/krista-logo.svg';
  }

  // Template method aliases
  onRestart(): void {
    this.onClickStartOver();
  }

  onClose(): void {
    this.onCloseClick();
  }
}
