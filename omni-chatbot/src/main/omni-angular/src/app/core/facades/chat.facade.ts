import { Injectable } from '@angular/core';
import { KrFieldValueResolver } from '../../utils/kr-field-value-resolver';
import { createMediaUrlDownload } from '../../utils/media-url.util';
import { ConfigService } from '../../services/config.service';
import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { ChatStateService } from '../state';
import { MessageRepository } from '../repositories';
import { MessageTypeService } from '../strategies';
import { NotificationService } from '../../services/notification.service';
import { LoadingService } from '../../services/loading.service';
import { TranslationService } from '../../services/translation.service';
import { KristaIdService } from '../../services/krista-id.service';
import { AuthApiService } from '../../services/auth-api.service';
import { ClientApiService } from '../../services/client-api.service';
import { KSDKMessage, MessageType, KristaId } from '../../../ui-toolkit-src-angular';
import { UserData } from '../../models/config.model';
import { SubmitType } from '../../models/message.model';
import {
  Signal,
  OutboundNotificationType,
  InboundNotificationType,
  INotificationSignal,
  MessageType as WSMessageType,
  KSDKAccount
} from '../../models/websocket.model';
import {
  MessageDto,
  FormDto,
  FormPageDto,
  FormFieldDto,
  OutboundMessagePayload
} from '../../models/api.model';
import { FormResponse } from '../../models/message.model';

/**
 * Chat Facade Service
 *
 * Provides a simplified interface for chat operations.
 * Follows Facade Pattern to reduce component complexity.
 *
 * Responsibilities:
 * - Orchestrates chat operations between state, repository, and services
 * - Provides a clean API for components
 * - Handles message conversion and WebSocket communication
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only handles chat orchestration
 * - Dependency Inversion: Depends on abstractions (state, repository)
 * - Open/Closed: New features can be added without modifying existing code
 */
@Injectable({
  providedIn: 'root'
})
export class ChatFacade {
  // Expose state selectors for components (read-only)
  // These are initialized in the constructor to avoid "used before initialization" errors
  readonly messages$!: Observable<KSDKMessage[]>;
  readonly isLoading$!: Observable<boolean>;
  readonly sessionId$!: Observable<string>;
  readonly userData$!: Observable<UserData | null>;
  readonly hideFooter$!: Observable<boolean>;
  readonly isSessionTimedOut$!: Observable<boolean>;
  readonly isStatusMode$!: Observable<boolean>;
  readonly statusMessages$!: Observable<string[]>;
  readonly statusImage$!: Observable<string | null>;

  // Latest server-sent ExecutionStateUpdateNotification.state — single source of truth.
  // Bubble visibility is derived from (latestExecutionState, messages) — see constructor.
  private latestExecutionStateSubject = new BehaviorSubject<string | null>(null);
  // Client-side flag: true between welcome bubble injection and the first NewMessages
  // arrival from the welcome conversation. Pure derivation input — not exposed.
  // Cleared by: first incoming NewMessages, any non-'waiting' execution-state signal,
  // and user-initiated send (which has its own loader).
  private awaitingWelcomeFirstMessageSubject = new BehaviorSubject<boolean>(false);
  readonly isTyping$!: Observable<boolean>;

  // Subject to notify when user sends a message (for auto-scroll)
  private userSentMessageSubject = new Subject<void>();
  readonly userSentMessage$ = this.userSentMessageSubject.asObservable();

  private webSocketListenerRegistered = false;
  private lastSubmittedFormMessageId: string | null = null;

  constructor(
    private chatState: ChatStateService,
    private messageRepository: MessageRepository,
    private messageTypeService: MessageTypeService,
    private notificationService: NotificationService,
    private loadingService: LoadingService,
    private translationService: TranslationService,
    private kristaIdService: KristaIdService,
    private authApiService: AuthApiService,
    private clientApiService: ClientApiService,
    private configService: ConfigService
  ) {
    // Initialize observables from state service
    this.messages$ = this.chatState.messages$;
    this.isLoading$ = this.chatState.isLoadingMessages$;
    this.sessionId$ = this.chatState.sessionId$;
    this.userData$ = this.chatState.userData$;
    this.hideFooter$ = this.chatState.hideFooter$;
    this.isStatusMode$ = this.chatState.isStatusMode$;
    this.statusMessages$ = this.chatState.statusMessages$;
    this.statusImage$ = this.chatState.statusImage$;
    this.isSessionTimedOut$ = this.chatState.isSessionTimedOut$;
    // Show typing bubble when EITHER the server's latest state is "waiting" OR we are
    // awaiting the first welcome-conversation message after injecting the welcome bubble,
    // AND the last message is not a MessageAsk (i.e., bot is computing, not waiting on the user).
    this.isTyping$ = combineLatest([
      this.latestExecutionStateSubject,
      this.chatState.messages$,
      this.awaitingWelcomeFirstMessageSubject,
      this.chatState.isSessionTimedOut$,
    ]).pipe(
      map(([state, msgs, awaitingWelcome, sessionTimedOut]) => {
        // Once the session has timed out the WS is gone, so no non-'waiting'
        // execution-state signal can ever arrive to clear a stale 'waiting' state.
        // Force the typing bubble off (mirrors the irreversible footer-hide).
        if (sessionTimedOut) return false;
        const last = msgs[msgs.length - 1];
        const lastNotAsk = last?.messageType !== MessageType.Ask;
        return (state === 'waiting' || awaitingWelcome) && lastNotAsk;
      }),
      distinctUntilChanged(),
    );

    this.setupWebSocketListener();
  }

  // ============================================================================
  // Public API - Actions
  // ============================================================================

  /**
   * Load message history for an inbox.
   *
   * @param inboxId session inbox to load
   */
  loadMessageHistory(inboxId: string): void {
    this.chatState.setLoadingMessages(true);
    const loadingMessage = this.translationService.instant('initializerProvider.loadingConversationHistory');
    this.loadingService.setMessageHistoryLoading(true, loadingMessage);

    const loadingStartTime = Date.now();
    const minimumLoadingTime = 1500;

    this.messageRepository.getInitialMessages(inboxId).subscribe({
      next: (response) => {
        if (response.messages?.length > 0) {
          const initialMessages = response.messages.flatMap(msg => this.convertToKSDKMessages(msg));

          // Load older messages
          this.messageRepository.getOlderMessages(inboxId, response.messages[0].id).subscribe({
            next: (olderResponse) => {
              const olderMessages = olderResponse.messages?.flatMap(msg => this.convertToKSDKMessages(msg)) || [];
              const uniqueOlder = olderMessages.filter(m => !initialMessages.some(i => i.id === m.id));
              let allMessages = [...uniqueOlder, ...initialMessages];
              allMessages = this.markStaleAskMessages(allMessages);
              this.chatState.setMessages(allMessages);
              this.finishLoading(loadingStartTime, minimumLoadingTime);
            },
            error: () => {
              const marked = this.markStaleAskMessages(initialMessages);
              this.chatState.setMessages(marked);
              this.finishLoading(loadingStartTime, minimumLoadingTime);
            }
          });
        } else {
          // No server-side history for this returning session. The welcome greeting is
          // owned by the backend, which pushes it over the WebSocket when the session
          // hasn't been welcomed yet — so nothing to inject client-side here.
          this.finishLoading(loadingStartTime, minimumLoadingTime);
        }
      },
      error: () => this.finishLoading(loadingStartTime, minimumLoadingTime)
    });
  }

  /**
   * Send a text message
   */
  sendMessage(message: string): void {
    const sessionId = this.chatState.sessionId;
    const userData = this.chatState.currentState.userData;

    if (!userData || !sessionId) return;

    const account: KSDKAccount = { accountId: userData.accountId, name: userData.name };
    const messagePayload = this.createMessagePayload(sessionId, message, account);
    const optimisticMessage = this.createOptimisticMessage(messagePayload, account);

    this.chatState.addMessage(optimisticMessage);

    // Notify that user sent a message (for auto-scroll to bottom)
    this.userSentMessageSubject.next();

    // Outbound user activity owns the loader from here on; drop any pending
    // welcome-await flag so we don't double-source the typing bubble.
    if (this.awaitingWelcomeFirstMessageSubject.value) {
      this.awaitingWelcomeFirstMessageSubject.next(false);
    }
    this.loadingService.setWebSocketLoading(true, 'Waiting for response...');
    this.sendViaWebSocket(sessionId, messagePayload);
  }

  /**
   * Signal that we are waiting for the first welcome message from the backend (the
   * static Welcome Message or the Welcome Conversation's first reply, both pushed over
   * the WebSocket on connect). Causes the typing bubble to appear via isTyping$ until
   * either: a NewMessages arrives, a non-'waiting' execution-state signal arrives, or
   * the user sends their own message.
   */
  markAwaitingWelcomeFirstMessage(): void {
    this.awaitingWelcomeFirstMessageSubject.next(true);
  }

  /**
   * Submit a form response
   */
  submitForm(messageId: string, formResponse: FormResponse): void {
    const sessionId = this.chatState.sessionId;
    if (!sessionId) return;

    // Only mark message as answered for main form submissions (submit or path)
    // NOT for sidebar submissions - sidebars should remain clickable
    const isMainFormSubmit = formResponse.submitType === SubmitType.submit ||
                             formResponse.submitType === SubmitType.path;

    if (isMainFormSubmit) {
      this.lastSubmittedFormMessageId = messageId;
      // Immediately update the message submit type so the bubble moves to the right
      this.updateMessageSubmitType(messageId, formResponse.submitType, formResponse.submitValue);
    }

    this.loadingService.setWebSocketLoading(true, 'Processing form submission...');

    // Trigger scroll to bottom so the typing indicator is visible to the user
    this.userSentMessageSubject.next();

    const inboxId = this.kristaIdService.createInboxId(sessionId);
    const notification = this.createFormSubmissionNotification(inboxId, messageId, formResponse);
    this.notificationService.sendNotification(notification);
  }

  // ============================================================================
  // State Setters (delegated to ChatStateService)
  // ============================================================================

  setSessionId(sessionId: string): void {
    this.chatState.setSessionId(sessionId);
  }

  setUserData(userData: UserData): void {
    this.chatState.setUserData(userData);
  }

  setHideFooter(hide: boolean): void {
    this.chatState.setHideFooter(hide);
  }

  // ============================================================================
  // Snapshot Getters
  // ============================================================================

  get currentSessionId(): string {
    return this.chatState.sessionId;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupWebSocketListener(): void {
    if (this.webSocketListenerRegistered) return;
    this.webSocketListenerRegistered = true;

    this.notificationService.receiveNotification(
      InboundNotificationType.NewMessages,
      {
        onNotificationSignal: (signal) => {
          this.handleIncomingMessages(signal);
        }
      }
    );

    // Server-driven execution state — drives isTyping$ via the combineLatest derivation
    // in the constructor. Bubble shows when state === "waiting" AND last message is not
    // a MessageAsk. The client-side stop-gap loader is cleared on non-waiting states.
    this.notificationService.receiveNotification(
      InboundNotificationType.ExecutionStateUpdateNotification,
      {
        onNotificationSignal: (signal) => {
          if (signal.payload.type === InboundNotificationType.ExecutionStateUpdateNotification) {
            const payload = signal.payload.payload;
            const rawState = payload?.['state'];
            const state = typeof rawState === 'string' ? rawState : null;
            this.latestExecutionStateSubject.next(state);
            // Track conversation execution + clear status overlay once execution ends.
            const isExecuting = state !== null && state !== 'inactive';
            this.chatState.setConversationExecuting(isExecuting);
            if (!isExecuting) {
              this.chatState.clearStatusMode();
              this.chatState.setHideFooter(false);
            }
            if (state !== 'waiting') {
              this.loadingService.setWebSocketLoading(false);
              // Server has moved off 'waiting' — welcome-await is no longer meaningful.
              if (this.awaitingWelcomeFirstMessageSubject.value) {
                this.awaitingWelcomeFirstMessageSubject.next(false);
              }
            }
          }
        }
      }
    );
  }

  private handleIncomingMessages(signal: INotificationSignal<InboundNotificationType>): void {
    if (signal.payload.type !== InboundNotificationType.NewMessages) return;

    const payload = signal.payload.payload;
    if (!payload['messages'] || !Array.isArray(payload['messages'])) return;

    // Session timeout: a message flagged isSessionTimeout means the server (or the
    // WS 1008-close injector) is ending this session. Tear down the connection, clear
    // server-side session state, and mark the session timed out — which hides the footer
    // irreversibly (ChatStateService.setHideFooter then becomes a no-op). The synthetic
    // timeout message itself still flows through below so the user sees the notice bubble.
    const hasSessionTimeout = payload['messages'].some((msg: any) => msg.isSessionTimeout === true);
    // Teardown is one-shot: guard on the irreversible isSessionTimedOut flag so a
    // repeated timeout signal cannot fire a second logout call.
    if (hasSessionTimeout && !this.chatState.currentState.isSessionTimedOut) {
      // Mark the socket as timed out so a later 1008 close does NOT inject a
      // duplicate synthetic timeout message — the real backend message has
      // already been received here (with the correct text and creationTime).
      // The client-side injection then only fires for the offline-miss case.
      this.clientApiService.markSessionTimedOut();
      this.clientApiService.disconnect();
      this.authApiService.logout().subscribe({
        error: (err) => console.error('Error calling logout API on session timeout:', err)
      });
      this.chatState.setSessionTimedOut();
      // Clear the client-side stop-gap loader too: the template shows the typing
      // bubble on (isTyping || isWebSocketLoading$), and no further WS message will
      // arrive to clear it once the session has ended.
      this.loadingService.setWebSocketLoading(false);
    }

    const currentMessages = this.chatState.messages;
    const newMessages: KSDKMessage[] = [];

    payload['messages'].forEach((msgData: any) => {
      if (currentMessages.some(msg => msg.id === msgData.id)) return;
      const converted = this.convertToKSDKMessages(msgData);
      newMessages.push(...converted);
    });

    if (newMessages.length > 0) {
      this.chatState.setMessages([...currentMessages, ...newMessages]);
      // First genuine inbound message also concludes the welcome-await window.
      if (this.awaitingWelcomeFirstMessageSubject.value) {
        this.awaitingWelcomeFirstMessageSubject.next(false);
      }
    }

    // Detect a status inform step on the last message and drive the status overlay.
    const allMessages = this.chatState.messages;
    if (allMessages.length > 0) {
      const lastMessage = allMessages[allMessages.length - 1];
      if (lastMessage.isStatusInform) {
        const rawMessage = lastMessage.message ?? '';
        const resolvedMessage = KrFieldValueResolver.resolveToText(rawMessage).trim();
        const resolvedStatusMessages = (lastMessage.statusMessages ?? []).map((sm: string) => KrFieldValueResolver.resolveToText(sm));
        const mediaIdMatch = rawMessage.match(/data-mediaid=["']([^"']+)["']/);
        const workspaceId = this.configService.getCurrentConfig()?.workspaceId;
        const imageUrl = mediaIdMatch && workspaceId
          ? createMediaUrlDownload(workspaceId, mediaIdMatch[1])
          : null;
        this.chatState.setStatusMode([resolvedMessage, ...resolvedStatusMessages], imageUrl);
      } else if (this.chatState.currentState.isStatusMode) {
        this.chatState.clearStatusMode();
        // Recompute footer visibility from the last message instead of forcing it
        // visible: an editable-form Ask arriving while the status overlay is up must
        // keep the free-text footer hidden (mirrors timeline-view's messages$ rule).
        // clearStatusMode() does not re-emit messages$, so that recompute never re-fires.
        const keepFooterHidden = lastMessage.messageType === MessageType.Ask &&
          (!lastMessage.form || !lastMessage.form.readOnly);
        this.chatState.setHideFooter(keepFooterHidden);
      }
    }

    // Check if this is the form answer echo (triggers split) — loader should stay
    const isFormAnswerEcho = !!this.lastSubmittedFormMessageId;

    // Update the submitted form message to Answered regardless of whether new messages
    // were added. The backend may echo back the same message ID with type MessageAnswered,
    // which gets skipped by the duplicate check above. We still need to update the
    // original MessageAsk to MessageAnswered so the footer re-enables.
    if (this.lastSubmittedFormMessageId) {
      this.updateMessageToAnswered(this.lastSubmittedFormMessageId);
      this.lastSubmittedFormMessageId = null;
    }

    this.chatState.setLoadingMessages(false);
    // Clear the client-side stop-gap loader once a genuinely new bot message arrives.
    if (newMessages.length > 0 && !isFormAnswerEcho) {
      this.loadingService.setWebSocketLoading(false);
    }
  }

  private updateMessageSubmitType(messageId: string, submitType: string, submitValue?: string): void {
    const messages = this.chatState.messages;
    const targetIndex = messages.findIndex(msg => msg.id === messageId);
    if (targetIndex === -1) return;

    const targetMessage = messages[targetIndex];
    // Keep original sender so the message stays on the LEFT side.
    // The split message (created in updateMessageToAnswered) handles the RIGHT side.
    const userAccount = targetMessage.senderAccount;

    const updatedMessage = new KSDKMessage(
      targetMessage.messageId,
      targetMessage.messageType,
      targetMessage.inboxId,
      targetMessage.creationTime,
      userAccount,
      targetMessage.userMessage,
      targetMessage.media,
      targetMessage.form,
      { ...(targetMessage.submit || {}), type: submitType, value: submitValue } as any,
      targetMessage.executionMeta,
      targetMessage.paths,
      targetMessage.sideConversations,
      targetMessage.targetAudience,
      targetMessage.timer,
      targetMessage.sessionId,
      targetMessage.copies,
      targetMessage.responder,
      targetMessage.authentication,
      targetMessage.systemEventType,
      targetMessage.systemEventData,
      targetMessage.informStepType,
      targetMessage.statusMessages
    );

    const updatedMessages = [...messages];
    updatedMessages[targetIndex] = updatedMessage;
    this.chatState.setMessages(updatedMessages);

    // Notify for auto-scroll to bottom
    this.userSentMessageSubject.next();
  }

  private updateMessageToAnswered(messageId: string): void {
    const messages = this.chatState.messages;
    const targetIndex = messages.findIndex(msg => msg.id === messageId);
    if (targetIndex === -1) return;

    const targetMessage = messages[targetIndex];
    // Keep original bot sender so the message stays on the LEFT side.
    // The split message handles the RIGHT side display.
    const updatedMessage = new KSDKMessage(
      targetMessage.messageId,
      MessageType.Answered,
      targetMessage.inboxId,
      targetMessage.creationTime,
      targetMessage.senderAccount,
      targetMessage.userMessage,
      targetMessage.media,
      targetMessage.form,
      targetMessage.submit,
      targetMessage.executionMeta,
      targetMessage.paths,
      targetMessage.sideConversations,
      targetMessage.targetAudience,
      targetMessage.timer,
      targetMessage.sessionId,
      targetMessage.copies,
      targetMessage.responder,
      targetMessage.authentication,
      targetMessage.systemEventType,
      targetMessage.systemEventData,
      targetMessage.informStepType,
      targetMessage.statusMessages
    );

    const updatedMessages = [...messages];
    updatedMessages[targetIndex] = updatedMessage;

    // Create split message for the right side (read-only form display)
    const splitMessage = KSDKMessage.createSplitMessage(updatedMessage);
    if (splitMessage) {
      // Prevent duplicates — only insert if no existing split for this message
      const existingSplitIndex = updatedMessages.findIndex(
        m => m.isSplit && m.messageId === updatedMessage.messageId + '_1'
      );
      if (existingSplitIndex === -1) {
        updatedMessages.splice(targetIndex + 1, 0, splitMessage);
      }
    }

    this.chatState.setMessages(updatedMessages);
  }

  private convertToKSDKMessages(dto: MessageDto): KSDKMessage[] {
    const messageType = this.determineMessageType(dto);
    const processedForm = this.processFormData(dto.form);

    // Keep the original sender for all messages.
    // With split logic, the original message stays on the LEFT (bot sender, isIncoming=true),
    // and createSplitMessage() creates a RIGHT-side clone with the user's account.
    const senderAccount = dto.sender || { id: '', name: '' };

    // Convert single media to array if present (KSDKMessage expects array)
    const mediaArray = dto.media ? [dto.media] : undefined;
    // Convert timer keys: Original code uses start/end, backend may send either format
    const timer = dto.timer ? {
      startTime: (dto.timer as any).start ?? dto.timer.startTime,
      endTime: (dto.timer as any).end ?? dto.timer.endTime
    } : undefined;

    const message = new KSDKMessage(
      dto.id,
      messageType,
      KristaId.parse(dto.inboxId || ''),
      dto.creationTime || Date.now(),
      senderAccount,
      dto.userMessage || dto.message || '',
      mediaArray as any, // Type cast needed due to API/toolkit type mismatch
      processedForm as any, // Type cast needed due to API/toolkit type mismatch
      dto.submit as any,
      dto.executionMeta as any,
      dto.paths,
      dto.sideConversations,
      undefined,
      timer as any,
      dto.sessionId ? KristaId.parse(dto.sessionId) : undefined,
      dto.copies as any,
      dto.responder as any,
      dto.authentication as any,
      dto.systemEventType as any,
      dto.systemEventData as any,
      dto.informStepType,
      dto.statusMessages
    );

    // Create split message for answered form messages (mirrors original split logic)
    const messages: KSDKMessage[] = [message];
    const splitMessage = KSDKMessage.createSplitMessage(message);
    if (splitMessage) {
      messages.push(splitMessage);
    }
    return messages;
  }

  /**
   * Determine message type using Strategy Pattern
   * Delegates to MessageTypeService for clean separation of concerns
   */
  private determineMessageType(dto: MessageDto): MessageType {
    return this.messageTypeService.determineMessageType(dto);
  }

  private processFormData(formData: FormDto | FormPageDto[] | undefined): FormDto | undefined {
    if (!formData) return undefined;

    let pages: FormPageDto[] = [];
    if (Array.isArray(formData)) {
      pages = formData;
    } else if (formData.pages && Array.isArray(formData.pages)) {
      pages = formData.pages;
    } else {
      return undefined;
    }

    const processedPages = pages.map((page: FormPageDto) => ({
      ...page,
      fields: (page.fields || []).map((field: FormFieldDto) => ({
        ...field,
        value: field.value,
        required: field.options?.required?.value || false,
        readOnly: field.options?.readOnly?.value || false,
        attributeValues: field.attributeValues || {},
        options: field.options || {}
      }))
    }));

    return { readOnly: false, hideForm: false, pages: processedPages };
  }

  private createMessagePayload(sessionId: string, message: string, sender: KSDKAccount): OutboundMessagePayload {
    const messageId = this.kristaIdService.createMessageId();
    const inboxId = this.kristaIdService.createInboxId(sessionId);
    const actualSessionId = sessionId.startsWith('inbox_') ? sessionId.replace('inbox_', '') : sessionId;

    return {
      sessionId: actualSessionId,
      id: messageId,
      inboxId,
      type: WSMessageType.Inform,
      sender: { id: sender.accountId, name: sender.name },
      message
    };
  }

  private createOptimisticMessage(payload: OutboundMessagePayload, account: KSDKAccount): KSDKMessage {
    const dto: MessageDto = {
      id: payload.id,
      type: 'MessageInform',
      inboxId: payload.inboxId,
      sessionId: payload.sessionId,
      creationTime: Date.now(),
      userMessage: payload.message,
      message: payload.message,
      sender: { id: account.accountId, name: account.name }
    };
    return this.convertToKSDKMessages(dto)[0];
  }

  private sendViaWebSocket(sessionId: string, messagePayload: OutboundMessagePayload): void {
    const notification: INotificationSignal<OutboundNotificationType> = {
      signal: Signal.notification,
      payload: {
        type: OutboundNotificationType.Message,
        timestamp: Date.now(),
        payload: { inboxId: sessionId, message: messagePayload }
      }
    };
    this.notificationService.sendNotification(notification);
  }

  private createFormSubmissionNotification(inboxId: string, messageId: string, formResponse: FormResponse): INotificationSignal<OutboundNotificationType> {
    return {
      signal: Signal.notification,
      payload: {
        type: OutboundNotificationType.MessageAnswer,
        timestamp: Date.now(),
        payload: {
          inboxId,
          message: {
            targetMessageId: messageId,
            creationTime: Date.now(),
            submitType: formResponse.submitType,
            submitValue: formResponse.submitValue,
            fieldValues: formResponse.values || null
          }
        }
      }
    };
  }

  /**
   * For history: any MessageAsk that has messages after it is already answered.
   * Set form.readOnly = true so the send button hides, without changing messageType.
   */
  private markStaleAskMessages(messages: KSDKMessage[]): KSDKMessage[] {
    if (messages.length === 0) return messages;

    const lastIndex = messages.length - 1;

    messages.forEach((msg, index) => {
      if (msg.messageType === MessageType.Ask && index < lastIndex && msg.form) {
        msg.form.readOnly = true;
      }
    });

    return messages;
  }

  private finishLoading(startTime: number, minimumTime: number): void {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, minimumTime - elapsed);

    setTimeout(() => {
      this.chatState.setLoadingMessages(false);
      this.loadingService.setMessageHistoryLoading(false);
    }, remaining);
  }
}

