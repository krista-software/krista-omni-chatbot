import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { ConfigService } from '../../services/config.service';
import { ChatFacade } from '../../core/facades';
import { InternalChatbotConfig, UserData } from '../../models/chatbot.models';

@Component({
  selector: 'app-footer',
  standalone: false,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  value: string = '';
  sessionId: string = '';
  userData: UserData | null = null;
  hideFooter: boolean = false;
  // While a status-inform step runs the input stays mounted and is greyed out instead
  // of being removed, so entering/leaving status mode causes no layout shift.
  isStatusMode: boolean = false;
  config: InternalChatbotConfig;
  isLoading: boolean = false;

  constructor(
    private configService: ConfigService,
    private chatFacade: ChatFacade,
    private cdr: ChangeDetectorRef,
    private translateService: TranslateService
  ) {
    // Initialize config immediately to prevent flickering
    this.config = this.configService.getCurrentConfig();
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    // Subscribe to session ID
    this.chatFacade.sessionId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(sessionId => {
        this.sessionId = sessionId;
        this.cdr.markForCheck();
      });

    // Subscribe to user data
    this.chatFacade.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(userData => {
        this.userData = userData;
        this.cdr.markForCheck();
      });

    // Subscribe to hide footer state
    this.chatFacade.hideFooter$
      .pipe(takeUntil(this.destroy$))
      .subscribe(hideFooter => {
        this.hideFooter = hideFooter;
        this.cdr.markForCheck();
      });

    // Subscribe to status mode — disables (not hides) the input while a status step runs
    this.chatFacade.isStatusMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isStatusMode => {
        this.isStatusMode = isStatusMode;
        this.cdr.markForCheck();
      });

    // Subscribe to config changes
    this.configService.getConfig()
      .pipe(takeUntil(this.destroy$))
      .subscribe((config: InternalChatbotConfig) => {
        this.config = config;
        this.cdr.markForCheck();
      });
  }

  setValue(newValue: string): void {
    this.value = newValue;
  }

  onEnterKeyPress(): void {
    this.handleSendBtnClick();
  }

  handleSendBtnClick(): void {
    // Guard status mode too: the send button is disabled in the template, but the
    // Enter key path reaches here directly.
    if (this.isStatusMode) {
      return;
    }
    const sendMessage = (this.value || '').trim();
    const valid = sendMessage.length > 0;

    if (valid && this.userData) {
      this.sendInboxTextMessage(sendMessage);
    }
  }

  private sendInboxTextMessage(sendMessage: string): void {
    if (this.userData) {
      // Clear input immediately for better UX
      this.value = '';
      this.cdr.markForCheck();

      // Use ChatFacade to send message
      this.chatFacade.sendMessage(sendMessage);
    }
  }

  get isDisabled(): boolean {
    return !this.value || this.value.length === 0 || this.isStatusMode;
  }

  get hideSendMessage(): boolean {
    return !!this.config?.config?.hideSendMessage;
  }

  get showTermsAndConditions(): boolean {
    return !!this.config?.config?.TnC;
  }

  get customTermsLabel(): string | null {
    return this.config?.config?.TnCLabel || null;
  }

  get termsAndConditionsUrl(): string {
    return this.config?.config?.TnC || '';
  }

  // Template method aliases
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onEnterKeyPress();
    }
  }

  onSend(): void {
    this.handleSendBtnClick();
  }
}
