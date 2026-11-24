import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { SubmitType } from '../../models/message.model';
import { ChatFacade } from '../../core/facades';
import { KristaFieldService } from '../../services/krista-field.service';
import { ConfigApiService } from '../../services/config-api.service';
import { TranslationService } from '../../services/translation.service';
import { LoadingService } from '../../services/loading.service';

// Import from UI Toolkit (will be replaced by library in future)
import { KSDKMessage, ToolkitConfig } from '../../../ui-toolkit-src-angular';

@Component({
  selector: 'app-message-bubble',
  standalone: false,
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBubbleComponent implements OnInit, OnDestroy {
  @Input() message!: KSDKMessage;
  @Input() topicId: string = '';
  @Input() isWelcomeMessage: boolean = false;

  errorFields: string[] = [];
  errorMessages: string[] = [];

  /** The sidebar label currently awaiting a WebSocket response */
  disabledSidebar: string | null = null;

  private sidebarTimeout: ReturnType<typeof setTimeout> | null = null;
  private sidebarResponseSub: Subscription | null = null;
  private destroyed$ = new Subject<void>();

  constructor(
    private chatFacade: ChatFacade,
    private kristaFieldService: KristaFieldService,
    private configApiService: ConfigApiService,
    private translationService: TranslationService,
    private loadingService: LoadingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Component initialized
  }

  ngOnDestroy(): void {
    this.clearSidebarTimeout();
    this.sidebarResponseSub?.unsubscribe();
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private clearSidebarTimeout(): void {
    if (this.sidebarTimeout !== null) {
      clearTimeout(this.sidebarTimeout);
      this.sidebarTimeout = null;
    }
  }

  private enableSidebar(): void {
    this.clearSidebarTimeout();
    this.sidebarResponseSub?.unsubscribe();
    this.sidebarResponseSub = null;
    this.disabledSidebar = null;
    this.cdr.markForCheck();
  }

  get isUserMessage(): boolean {
    // With split logic: original stays left (isIncoming=true), split goes right (isIncoming=false)
    return !this.message.isIncoming;
  }

  get isBotMessage(): boolean {
    return this.message.isIncoming;
  }

  /**
   * Check if message should render as form message
   * Matches original: {message.form ? <FormMessageComponent /> : <Component />}
   * Returns true if message has form object (even with empty pages) OR has paths/sidebars
   */
  get hasForm(): boolean {
    return !!this.message.form ||
           !!(this.message.paths && this.message.paths.length > 0) ||
           !!(this.message.sideConversations && this.message.sideConversations.length > 0);
  }

  /**
   * Check if message has a form object (even with empty pages)
   * Used for determining if sidebars should be shown
   * Matches original: formContent = message.form ? getFormContent(message) : null
   */
  get hasFormObject(): boolean {
    return !!this.message.form;
  }

  /**
   * Get sidebars from message.sideConversations
   * Matches original: sidebars: message.sideConversations || []
   */
  get sidebars(): string[] {
    return this.message.sideConversations || [];
  }

  /**
   * Check if sidebars should be shown
   * Matches original: formContent && !formContent.hideForm && formContent.sidebars.length > 0
   */
  get showSidebars(): boolean {
    // Split messages (right side) don't show sidebars — only the original (left) does
    if (this.message.isSplit) {
      return false;
    }
    return this.hasFormObject && this.sidebars.length > 0;
  }

  /**
   * Check if sidebars are read-only (form already submitted)
   * Sidebars should only be disabled when the MAIN form is submitted (submit type)
   * NOT when a sidebar is clicked - users can switch between sidebars anytime
   * Matches original: readOnly={formContent.isFormSubmitted || formContent.noAnswerForm}
   * where isFormSubmitted = submitType === "path" || submitType === "submit"
   */
  get sidebarReadOnly(): boolean {
    const submitType = (this.message.submit?.type || '').toLowerCase();
    // Only disable sidebars when main submit or path is clicked, NOT when sidebar is clicked
    const isMainFormSubmitted = submitType === 'submit' || submitType === 'path';
    const noAnswerForm = submitType === SubmitType.no_answer;
    return isMainFormSubmitted || noAnswerForm;
  }

  get messageContent(): string {
    return this.message.userMessage || this.message.message || '';
  }

  get isAuthenticationMessage(): boolean {
    return !!this.message.authentication;
  }

  get isResponseAckMessage(): boolean {
    return !!this.message.responder;
  }

  get isSystemEventMessage(): boolean {
    return !!this.message.isSystemEventMessage;
  }

  get systemEventText(): string {
    if (!this.isSystemEventMessage) {
      return '';
    }

    const accountName = this.message.systemEventData?.account?.name || '';

    if (this.message.systemEventType === 'join-task') {
      return this.translationService.instant('agent.joined', { name: accountName });
    } else if (this.message.systemEventType === 'leave-task') {
      return this.translationService.instant('agent.left', { name: accountName });
    }

    return this.message.systemEventType || 'System Event';
  }

  get isTextMessage(): boolean {
    return !this.hasForm && !this.isAuthenticationMessage && !this.isResponseAckMessage && !this.isSystemEventMessage;
  }

  /**
   * Check if the message bubble has any visible content to display.
   * Hides empty bubbles that have no text, no form fields, no paths, and no sidebars.
   * Uses KSDKMessage.doHideMessageInChat (matches original app pattern).
   */
  get hasVisibleContent(): boolean {
    // Hide status inform messages — shown via the status overlay, not as bubbles
    if (this.message.isStatusInform) {
      return false;
    }

    // original app pattern: hide answered incoming messages with readOnly form and no text
    if (this.message.doHideMessageInChat) {
      return false;
    }

    // Auth, responder, and system event messages always have content
    if (this.isAuthenticationMessage || this.isResponseAckMessage || this.isSystemEventMessage) {
      return true;
    }

    // Form messages: check if there's actually something visible to render
    if (this.hasForm) {
      const hasText = !!(this.message.userMessage || this.message.message);
      const hasFormFields = this.message.form?.pages?.some((p: any) => p.fields?.length > 0) || false;
      const hasPaths = !!(this.message.paths && this.message.paths.length > 0);
      const hasSidebars = this.showSidebars;
      // Form with send button (not readOnly, not answered, no paths, not no_answer)
      const canSend = !!this.message.form && !this.message.form.readOnly &&
                      !hasPaths && this.message.submit?.type !== SubmitType.no_answer;
      return hasText || hasFormFields || hasPaths || hasSidebars || canSend;
    }

    // Text messages: only show if there's actual content
    return !!this.messageContent.trim();
  }

  /**
   * Get message creation time as Date object for use with time format pipes
   */
  get messageTime(): Date {
    const timestamp = this.message.getCreationTime();
    return new Date(timestamp);
  }

  /**
   * Get sender name for incoming messages
   * Matches original app pattern: shows botName from config if sender is Krista, otherwise shows sender's name
   */
  get senderName(): string | null {
    if (!this.message.isIncoming || !this.message.senderAccount) {
      return null;
    }

    const toolkitConfig = ToolkitConfig.getInstance().getConfig();
    const kristaAccountId = toolkitConfig?.kristaAccountId;

    // If sender is Krista, show configured bot name, otherwise show sender's actual name
    if (this.message.senderAccount.id === kristaAccountId) {
      return toolkitConfig?.config?.botName || this.message.senderAccount.name || 'Krista';
    }

    return this.message.senderAccount.name || null;
  }

  /**
   * Check if sender name should be displayed
   */
  get showSenderName(): boolean {
    return this.message.isIncoming && !!this.message.senderAccount;
  }

  /**
   * Open authentication URL in new window (matches original app behavior)
   */
  openAuthUrl(authUrl: string): void {
    if (authUrl) {
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Handle authentication button click safely
   */
  handleAuthClick(): void {
    if (this.message.authentication?.authUrl) {
      this.openAuthUrl(this.message.authentication.authUrl);
    }
  }

  /**
   * Handle sidebar click
   * Disables the clicked button immediately, submits via WebSocket, then
   * re-enables the button once a response is received (or after a 30-second
   * timeout to prevent the button staying permanently disabled on error).
   */
  onSidebarClick(event: { type: SubmitType; sidebar: string }): void {
    // 1. Disable the clicked button immediately
    this.disabledSidebar = event.sidebar;
    this.cdr.markForCheck();

    // 2. Submit the sidebar form; returns false if nothing was sent
    const submitted = this.onSendFormData(event.type, event.sidebar);

    if (!submitted) {
      // Nothing sent – re-enable right away
      this.disabledSidebar = null;
      this.cdr.markForCheck();
      return;
    }

    // 3. Safety timeout: re-enable after 30 s in case the WebSocket never responds
    this.clearSidebarTimeout();
    this.sidebarResponseSub?.unsubscribe();
    this.sidebarTimeout = setTimeout(() => this.enableSidebar(), 30_000);

    // 4. Re-enable as soon as the WebSocket loading state clears
    //    (chatFacade.submitForm sets it true; handleIncomingMessages sets it false)
    this.sidebarResponseSub = this.loadingService.isWebSocketLoading$.pipe(
      filter(loading => !loading),
      take(1),
      takeUntil(this.destroyed$)
    ).subscribe(() => this.enableSidebar());
  }

  onSendFormData(submitType: SubmitType = SubmitType.submit, submitValue: string = '', formFields?: any[]): boolean {
    const form = this.message.form;
    if (!form || form.readOnly) {
      return false;
    }

    // Use updated formFields if provided, otherwise use original form
    const fieldsToValidate = formFields || this.getFormFields(form);

    // Validate form fields
    let formValid = true;
    const newErrorFields: string[] = [];

    if (submitType !== SubmitType.sidebar) {
      fieldsToValidate.forEach((field: any) => {
        if (field.required && (!field.value || field.value === '') && field.fieldType !== "com.krista.fields.Switch") {
          newErrorFields.push(field.name);
          formValid = false;
        }
      });
      this.errorFields = newErrorFields;
    }

    if (submitType === SubmitType.sidebar || formValid) {
      this.errorFields = [];
      this.errorMessages = [];

      // Prepare form response using updated fields
      const formToUse = formFields ? { pages: [{ fields: formFields }] } : form;
      const formResponse = this.prepareFormResponse(formToUse);
      formResponse.submitType = submitType;
      formResponse.submitValue = submitValue;

      // Submit form through chat facade
      this.chatFacade.submitForm(this.message.id!, formResponse);
      return true;
    }

    return false;
  }

  /**
   * Extract all fields from form pages
   */
  private getFormFields(form: any): any[] {
    const fields: any[] = [];
    form.pages?.forEach((page: any) => {
      if (page.fields) {
        fields.push(...page.fields);
      }
    });
    return fields;
  }

  private prepareFormResponse(form: any): any {
    const fieldValues: { [key: string]: any } = {};

    form.pages?.forEach((page: any) => {
      page.fields?.forEach((field: any) => {
        fieldValues[field.name] = this.formatFieldValueForSubmission(field);
      });
    });

    return {
      values: fieldValues,
      submitType: SubmitType.submit,
      submitValue: ''
    };
  }

  /**
   * Format field value for submission using toolkit
   * This converts UI values to Krista backend schema format
   */
  private formatFieldValueForSubmission(field: any): any {
    // For empty values: send empty string instead of undefined so the backend
    // doesn't fall back to the initial/default value
    if (!field.value && field.value !== 0 && field.value !== false) {
      return '';
    }

    // File fields: backend expects an array of file objects.
    // The file-field component emits [fileMetadata] (array), but if the value
    // came from the backend as a single object (e.g., pre-filled form), wrap it.
    if (field.fieldType === 'com.krista.fields.File') {
      const value = field.value;
      if (value && !Array.isArray(value) && typeof value === 'object') {
        return [value];
      }
      return value;
    }

    // Use toolkit's getKristaValue to convert to backend schema format
    // This handles Phone (countryCode/nationalNumber), Date (timestamp),
    // DateRange (with type field), Percentage (decimal), Number, Currency, etc.
    return this.kristaFieldService.getKristaValue(field, field.value);
  }


}
