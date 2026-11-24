import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { UserData } from '../models/config.model';
import { FormResponse } from '../models/message.model';
import {
  MessageDto,
  FormDto,
  FormPageDto,
  FormFieldDto,
  OutboundMessagePayload
} from '../models/api.model';
import {
  Signal,
  OutboundNotificationType,
  InboundNotificationType,
  INotificationSignal,
  MessageType as WSMessageType,
  KSDKAccount
} from '../models/websocket.model';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';
import { MessagesApiService } from './messages-api.service';
import { SessionService } from './session.service';
import { MessageApiService } from './message-api.service';
import { KristaIdService } from './krista-id.service';
import { LoadingService } from './loading.service';
import { TranslationService } from './translation.service';

// Import from UI Toolkit (will be replaced by library in future)
import { KSDKMessage, MessageType, KristaId, KSDKMedia, KSDKForm, FormPage, FormField } from '../../ui-toolkit-src-angular';

/**
 * File value structure
 */
interface FileValue {
  name: string;
  fileName: string;
  size?: number;
  path?: string;
  url?: string;
}

/**
 * Phone value structure from API
 */
interface PhoneValue {
  countryCode?: string;
  nationalNumber?: string;
  number?: string;
  phoneNumber?: string;
  value?: string;
  displayValue?: string;
  formattedNumber?: string;
  internationalNumber?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private sessionIdSubject = new BehaviorSubject<string>('');
  private userDataSubject = new BehaviorSubject<UserData | null>(null);
  private hideFooterSubject = new BehaviorSubject<boolean>(false);
  private messagesSubject = new BehaviorSubject<KSDKMessage[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private webSocketListenerRegistered = false; // Guard to prevent duplicate listener registration
  private lastSubmittedFormMessageId: string | null = null; // Track the last submitted form message

  public messages$ = this.messagesSubject.asObservable();
  public isLoading$ = this.isLoadingSubject.asObservable();

  // Subject to notify when user sends a message (for auto-scroll)
  private userSentMessageSubject = new Subject<void>();
  public userSentMessage$ = this.userSentMessageSubject.asObservable();

  constructor(
    private notificationService: NotificationService,
    private storageService: StorageService,
    private sessionService: SessionService,
    private messageApiService: MessageApiService,
    private kristaIdService: KristaIdService,
    private messagesApiService: MessagesApiService,
    private loadingService: LoadingService,
    private translationService: TranslationService
  ) {
    // Initialize with empty data - will be set by authentication and session creation
    this.sessionIdSubject.next('');
    this.userDataSubject.next(null);

    // Set up WebSocket message listener
    this.setupWebSocketListener();

    // Removed automatic loadMessageHistory call - app component will call it explicitly
    // to avoid duplicate API calls
  }


  /**
   * Load initial messages from API using the correct API sequence
   * 1. First API: GET /chatbot/inboxes/{inboxId}/messages?inboxId={inboxId}&inclusive=false&pageSize=20
   * 2. Second API: GET /chatbot/inboxes/{inboxId}/messages?inboxId={inboxId}&offset={messageId}&inclusive=true&pageSize=-20
   */
  loadMessageHistory(inboxId: string): void {
    this.isLoadingSubject.next(true);
    // Use dedicated message history loading state with translated message
    const loadingHistoryMessage = this.translationService.instant('initializerProvider.loadingConversationHistory');
    this.loadingService.setMessageHistoryLoading(true, loadingHistoryMessage);

    // Record start time for minimum display duration
    const loadingStartTime = Date.now();
    const minimumLoadingTime = 1500; // 1.5 second minimum for better visibility

    // Step 1: Call the first API to get initial messages
    this.messagesApiService.getInitialMessages(inboxId).subscribe({
      next: (response) => {
        let allMessages: KSDKMessage[] = [];

        if (response.messages && response.messages.length > 0) {
          // Convert first batch of messages (flatMap to handle split messages)
          // Deduplicate: keep the Answered version over Ask when same ID appears
          const initialMessages: KSDKMessage[] = response.messages.flatMap(msg => this.convertMessageDtoToKSDKMessages(msg));
          initialMessages.forEach(msg => {
            const existingIndex = allMessages.findIndex(m => m.id === msg.id);
            if (existingIndex === -1) {
              allMessages.push(msg);
            } else if (msg.messageType === MessageType.Answered &&
                       allMessages[existingIndex].messageType === MessageType.Ask) {
              allMessages[existingIndex] = msg;
            }
          });

          // Step 2: Get the first message ID as offset for the second API call
          const firstMessageId = response.messages[0].id;

          // Call the second API with offset and negative page size
          this.messagesApiService.getOlderMessages(inboxId, firstMessageId).subscribe({
            next: (olderResponse) => {
              if (olderResponse.messages && olderResponse.messages.length > 0) {
                // Convert older messages (flatMap to handle split messages)
                const olderMessages: KSDKMessage[] = olderResponse.messages.flatMap(msg => this.convertMessageDtoToKSDKMessages(msg));

                // Merge messages: if an older message has the same ID as an existing one,
                // keep the more progressed version (Answered > Ask)
                olderMessages.forEach(olderMsg => {
                  const existingIndex = allMessages.findIndex(m => m.id === olderMsg.id);
                  if (existingIndex === -1) {
                    // New message — prepend
                    allMessages.unshift(olderMsg);
                  } else if (olderMsg.messageType === MessageType.Answered &&
                             allMessages[existingIndex].messageType === MessageType.Ask) {
                    // Replace Ask with Answered version
                    allMessages[existingIndex] = olderMsg;
                  }
                });
              }

              // Mark any MessageAsk that is not the last message as already answered
              // If the conversation continued past a form, it must have been submitted
              allMessages = this.markStaleAskMessages(allMessages);

              // Set all messages and finish loading
              this.messagesSubject.next(allMessages);

              // Ensure minimum loading time before hiding loader
              this.finishLoadingWithMinimumTime(loadingStartTime, minimumLoadingTime);
            },
            error: () => {
              // If second API fails, still show the first batch of messages
              allMessages = this.markStaleAskMessages(allMessages);
              this.messagesSubject.next(allMessages);

              // Ensure minimum loading time before hiding loader
              this.finishLoadingWithMinimumTime(loadingStartTime, minimumLoadingTime);
            }
          });
        } else {
          // No messages from first API
          // Ensure minimum loading time before hiding loader
          this.finishLoadingWithMinimumTime(loadingStartTime, minimumLoadingTime);
        }
      },
      error: () => {
        // Ensure minimum loading time before hiding loader
        this.finishLoadingWithMinimumTime(loadingStartTime, minimumLoadingTime);
        // Keep existing mock messages if API fails
      }
    });
  }

  /**
   * Convert MessageDto to KSDKMessage using the toolkit class constructor
   * This ensures isIncoming is automatically calculated in the constructor
   * Returns an array of messages (original + split message if applicable)
   */
  private convertMessageDtoToKSDKMessages(dto: MessageDto): KSDKMessage[] {

    // Determine message type first
    const messageType = this.determineMessageType(dto);

    // Process form data
    const processedForm = this.processFormData(dto.form);

    // Keep the original sender for all messages.
    // With split logic, the original message stays on the LEFT (bot sender, isIncoming=true),
    // and createSplitMessage() creates a RIGHT-side clone with the user's account.
    const senderAccount = dto.sender || { id: '', name: '' };

    // Convert MediaDto to KSDKMedia[] if present
    const media: KSDKMedia[] | undefined = dto.media ? [dto.media as KSDKMedia] : undefined;

    // Convert ExecutionMetaDto to KSDKExecutionMeta if present
    const executionMeta = dto.executionMeta ? {
      executionId: dto.executionMeta.executionId,
      title: dto.executionMeta.title || ''
    } : undefined;

    // Convert TimerDto to KSDKTimer if present
    // Original code uses json["start"] and json["end"] keys (see KSDKTimer.fromJSON)
    const timer = dto.timer ? {
      startTime: (dto.timer as any).start ?? dto.timer.startTime,
      endTime: (dto.timer as any).end ?? dto.timer.endTime
    } : undefined;

    // Create KSDKMessage using the class constructor
    // The constructor will automatically set isIncoming based on sender ID comparison
    const message = new KSDKMessage(
      dto.id,                                    // messageId
      messageType,                               // messageType
      KristaId.parse(dto.inboxId || ''),        // inboxId
      dto.creationTime || Date.now(),           // creationTime
      senderAccount,                             // senderAccount
      dto.userMessage || dto.message || '',     // userMessage
      media,                                     // media (converted to array)
      processedForm,                             // form
      dto.submit,                                // submit
      executionMeta,                             // executionMeta
      dto.paths,                                 // paths
      dto.sideConversations,                     // sideConversations
      undefined,                                 // targetAudience
      timer,                                     // timer
      dto.sessionId ? KristaId.parse(dto.sessionId) : undefined, // sessionId
      dto.copies as { [key: string]: string } | undefined, // copies
      dto.responder,                             // responder
      dto.authentication ? { authUrl: dto.authentication.authUrl, systemName: dto.authentication.systemName || '' } : undefined, // authentication
      dto.systemEventType as 'join-task' | 'leave-task' | undefined, // systemEventType
      dto.systemEventData as { account: { name: string; _id: string }; activeParticipantCounts: number } | undefined, // systemEventData
      dto.informStepType, // informStepType
      dto.statusMessages // statusMessages
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
   * Determine message type based on message properties (matches original app logic)
   * Uses toolkit MessageType enum
   */
  private determineMessageType(dto: MessageDto): MessageType {
    // Check the type field directly first (matches original app exactly)
    if (dto.type === 'MessageInform') {
      return MessageType.Inform;
    }
    if (dto.type === 'MessageAnswered') {
      return MessageType.Answered;
    }
    if (dto.type === 'MessageAsk') {
      return MessageType.Ask;
    }
    if (dto.type === 'MessageResponseAck') {
      return MessageType.ResponseAck;
    }

    // For forms, determine if they should be editable (Ask) or read-only (Inform/Answered)
    const form = dto.form as FormDto | undefined;
    if (form && 'pages' in form && form.pages?.length > 0) {
      // If the form has submit information, it's likely answered
      if (dto.submit?.type === 'submit' || dto.submit?.type === 'path') {
        return MessageType.Answered;
      }

      // If the form is explicitly marked as readOnly in the data, it's informational
      if (form.readOnly === true) {
        return MessageType.Inform;
      }

      // Default for forms: Ask (editable) - this allows user to fill them out
      return MessageType.Ask;
    }

    // Default to Inform for other message types
    return MessageType.Inform;
  }

  /**
   * Process form data (matches original app processing)
   */
  private processFormData(formData: FormDto | FormPageDto[] | undefined): KSDKForm | undefined {

    if (!formData) {
      return undefined;
    }

    // Handle the case where formData is an array of pages (like in your example)
    let pages: FormPageDto[] = [];

    if (Array.isArray(formData)) {
      // formData is directly an array of pages
      pages = formData;
    } else if (formData.pages && Array.isArray(formData.pages)) {
      // formData has a pages property
      pages = formData.pages;
    } else {
      return undefined;
    }


    // Process pages and fields to match original app structure
    const processedPages: FormPage[] = pages.map((page: FormPageDto, pageIndex: number) => {

      return {
        ...page,
        fields: (page.fields || []).map((field: FormFieldDto, fieldIndex: number): FormField => {
          // Extract required and readOnly from nested options structure (matches original app)
          const fieldRequired = field.options?.required?.value || false;
          const fieldReadOnly = field.options?.readOnly?.value || false;

          // Backend sends displayLabel (matches original app behavior)
          // Use displayLabel if present, otherwise fall back to displayName, then name
          const displayLabel = field.displayLabel || field.displayName || field.name;


          const processedField = {
            fieldId: field.name, // Use name as fieldId
            fieldType: field.fieldType,
            name: field.name,
            displayName: displayLabel, // Use displayLabel from backend (supports i18n)
            label: displayLabel, // Use displayLabel for label too
            value: this.processFieldValue(field),
            required: fieldRequired,
            readOnly: fieldReadOnly,
            attributeValues: field.attributeValues || {},
            options: field.options || {}
          };


          return processedField;
        })
      };
    });

    const finalForm = {
      readOnly: false, // Form-level readOnly (will be set based on messageType)
      hideForm: false,
      pages: processedPages
    };


    return finalForm;
  }

  /**
   * Process field value based on field type
   */
  private processFieldValue(field: FormFieldDto): unknown {
    if (field.value === undefined || field.value === null) {
      // Return appropriate default value based on field type
      switch (field.fieldType) {
        case 'CheckboxesField':
        case 'PickManyField':
          return []; // Array for multi-select fields
        default:
          return ''; // Empty string for most fields
      }
    }

    // Handle specific field types that need value processing
    switch (field.fieldType) {
      case 'FileField':
        return this.processFileFieldValue(field.value);
      case 'TimeField':
        return this.processTimeFieldValue(field.value);
      case 'DateField':
        return this.processDateFieldValue(field.value);
      case 'PhoneField':
      case 'com.krista.fields.Phone':
        return this.processPhoneFieldValue(field.value);
      case 'CheckboxesField':
      case 'PickManyField':
        return this.processArrayFieldValue(field.value);
      default:
        return field.value;
    }
  }

  /**
   * Process file field value to handle different formats
   */
  private processFileFieldValue(value: unknown): FileValue | File | null {
    if (!value) return null;

    // If it's already a File object, return as is
    if (value instanceof File) return value;

    // If it's a string (file path), create a file-like object
    if (typeof value === 'string') {
      return {
        name: value.split('/').pop() || value,
        fileName: value.split('/').pop() || value,
        path: value
      };
    }

    // If it's an object with file info, ensure it has the right properties
    if (typeof value === 'object' && value !== null) {
      const fileObj = value as Record<string, unknown>;
      return {
        name: (fileObj['name'] as string) || (fileObj['fileName'] as string) || 'Unknown file',
        fileName: (fileObj['fileName'] as string) || (fileObj['name'] as string) || 'Unknown file',
        size: (fileObj['size'] as number) || (fileObj['fileSize'] as number) || 0,
        path: (fileObj['path'] as string) || (fileObj['url'] as string) || '',
        ...fileObj
      } as FileValue;
    }

    return null;
  }

  /**
   * Process time field value to ensure proper format
   */
  private processTimeFieldValue(value: unknown): string {
    if (!value) return '';

    const timeStr = String(value).trim();
    if (!timeStr) return '';

    // Return the value as is - the component will handle formatting
    return timeStr;
  }

  /**
   * Process phone field value to handle object format from API
   * IMPORTANT: Keep the phone object format {countryCode, nationalNumber} intact
   * so that the PhoneFormatter can properly format it with the country code
   */
  private processPhoneFieldValue(value: unknown): string | PhoneValue {
    if (!value) return '';

    // If it's already a string, return as is
    if (typeof value === 'string') return value;

    // If it's an object with countryCode and nationalNumber, return the object as-is
    // The PhoneFormatter will handle converting it to the proper display format
    if (typeof value === 'object' && value !== null) {
      const phoneObj = value as PhoneValue;
      if ('countryCode' in phoneObj && 'nationalNumber' in phoneObj) {
        return phoneObj;
      }

      // Common phone object properties from APIs
      if (phoneObj.number) return phoneObj.number;
      if (phoneObj.phoneNumber) return phoneObj.phoneNumber;
      if (phoneObj.value) return phoneObj.value;
      if (phoneObj.displayValue) return phoneObj.displayValue;
      if (phoneObj.formattedNumber) return phoneObj.formattedNumber;
      if (phoneObj.internationalNumber) return phoneObj.internationalNumber;
    }

    return String(value);
  }

  /**
   * Process date field value to ensure proper format
   */
  private processDateFieldValue(value: unknown): string {
    if (!value) return '';

    const dateStr = String(value).trim();
    if (!dateStr) return '';

    // Try to parse and format the date
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Return in YYYY-MM-DD format for date input
        return date.toISOString().split('T')[0];
      }
    } catch {
      // If parsing fails, return original value
    }

    return dateStr;
  }

  /**
   * Process array field value (checkboxes, pick many)
   */
  private processArrayFieldValue(value: unknown): unknown[] {
    if (!value) return [];

    // If it's already an array, return as is
    if (Array.isArray(value)) return value;

    // If it's a string, try to parse as JSON or split by comma
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // If JSON parsing fails, try splitting by comma
        return value.split(',').map(v => v.trim()).filter(v => v);
      }
    }

    // If it's a single value, wrap in array
    return [value];
  }

  private setupWebSocketListener(): void {
    // Prevent duplicate listener registration
    if (this.webSocketListenerRegistered) {
      return;
    }

    this.webSocketListenerRegistered = true;

    // Listen for incoming WebSocket messages
    this.notificationService.receiveNotification(
      InboundNotificationType.NewMessages,
      {
        onNotificationSignal: (signal) => {
          this.handleIncomingMessages(signal);
        }
      }
    );

    // Listen for UpdateMessage notifications (e.g., stream field updates)
    this.notificationService.receiveNotification(
      InboundNotificationType.UpdateMessage,
      {
        onNotificationSignal: (signal) => {
          this.handleUpdateMessages(signal);
        }
      }
    );
  }

  private handleIncomingMessages(signal: INotificationSignal<InboundNotificationType>): void {
    if (signal.payload.type === InboundNotificationType.NewMessages) {
      const payload = signal.payload.payload as { messages?: MessageDto[] };

      if (payload.messages && Array.isArray(payload.messages)) {
        const currentMessages = this.messagesSubject.value;
        const newMessages: KSDKMessage[] = [];

        payload.messages.forEach((msgData: MessageDto) => {
          // Check if message already exists to prevent duplicates
          const messageId = msgData.id;
          const existingMessage = currentMessages.find(msg => msg.id === messageId);

          if (existingMessage) {
            return; // Skip this message
          }

          // Use the enhanced conversion method for consistency (returns array with split message if applicable)
          const convertedMessages = this.convertMessageDtoToKSDKMessages(msgData);
          newMessages.push(...convertedMessages);
        });
        // Add new messages to the existing ones
        this.messagesSubject.next([...currentMessages, ...newMessages]);

        // Check if this is a response to a form submission
        // If we have new messages and we have a stored form message ID,
        // convert the submitted form message to a user message
        if (newMessages.length > 0 && this.lastSubmittedFormMessageId) {
          this.convertFormMessageToUserMessage(this.lastSubmittedFormMessageId);

          // Clear the stored message ID after conversion
          this.lastSubmittedFormMessageId = null;
        }

        // Stop loading indicators
        this.isLoadingSubject.next(false);
        this.loadingService.setWebSocketLoading(false);
      }
    }
  }

  private handleUpdateMessages(signal: INotificationSignal<InboundNotificationType>): void {
    if (signal.payload.type !== InboundNotificationType.UpdateMessage) {
      return;
    }

    const payload = signal.payload.payload as { messages?: MessageDto[] };
    if (!payload.messages || !Array.isArray(payload.messages)) {
      return;
    }

    const currentMessages = this.messagesSubject.value;
    let updated = false;

    payload.messages.forEach((msgData: MessageDto) => {
      const messageId = msgData.id;
      const existingIndex = currentMessages.findIndex(msg => msg.id === messageId);

      if (existingIndex !== -1) {
        const existing = currentMessages[existingIndex];
        // Update form data on existing message while preserving local state
        // (sender, submit status, isIncoming) to avoid moving the bubble
        const processedForm = this.processFormData(msgData.form);
        if (processedForm) {
          existing.form = processedForm;
        }
        updated = true;
      } else {
        // Message not found — add as new message
        const convertedMessages = this.convertMessageDtoToKSDKMessages(msgData);
        currentMessages.push(...convertedMessages);
        updated = true;
      }
    });

    if (updated) {
      this.messagesSubject.next([...currentMessages]);
    }
  }

  getSessionId(): Observable<string> {
    return this.sessionIdSubject.asObservable();
  }

  getCurrentSessionId(): string {
    return this.sessionIdSubject.value;
  }

  /**
   * Update session ID (called when session is created)
   */
  setSessionId(sessionId: string): void {
    this.sessionIdSubject.next(sessionId);
  }

  /**
   * Update user data (called when authentication is complete)
   */
  setUserData(userData: UserData): void {
    this.userDataSubject.next(userData);
  }

  /**
   * Update a message's type to mark it as answered/submitted
   * Changes the sender to current user so it appears on the right side
   */
  updateMessageTypeToAnswered(messageId: string): void {
    const currentMessages = this.messagesSubject.value;
    const targetMessageIndex = currentMessages.findIndex(msg => msg.id === messageId);

    if (targetMessageIndex === -1) {
      return;
    }

    const targetMessage = currentMessages[targetMessageIndex];

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

    // Replace the message in the array
    const updatedMessages = [...currentMessages];
    updatedMessages[targetMessageIndex] = updatedMessage;

    // Create split message for the right side (read-only form display)
    const splitMessage = KSDKMessage.createSplitMessage(updatedMessage);
    if (splitMessage) {
      const existingSplitIndex = updatedMessages.findIndex(
        m => m.isSplit && m.messageId === updatedMessage.messageId + '_1'
      );
      if (existingSplitIndex === -1) {
        updatedMessages.splice(targetMessageIndex + 1, 0, splitMessage);
      }
    }

    this.messagesSubject.next(updatedMessages);
  }

  /**
   * Convert a form message from bot message (left) to user message (right) after successful submission
   * This is called when the server responds with new messages after form submission
   */
  convertFormMessageToUserMessage(messageId: string): void {
    // Call the existing method to update the message type to Answered
    // This will create a new KSDKMessage with MessageType.Answered, which triggers right-alignment
    this.updateMessageTypeToAnswered(messageId);
  }

  getUserData(): Observable<UserData | null> {
    return this.userDataSubject.asObservable();
  }

  getCurrentUserData(): UserData | null {
    return this.userDataSubject.value;
  }

  getHideFooter(): Observable<boolean> {
    return this.hideFooterSubject.asObservable();
  }

  getCurrentHideFooter(): boolean {
    return this.hideFooterSubject.value;
  }

  setHideFooter(hide: boolean): void {
    this.hideFooterSubject.next(hide);
  }

  // Removed loadMessagesFromServer - using loadMessageHistory with correct API sequence instead

  /**
   * Create a local KSDKMessage instance for an outgoing user text message.
   * Mirrors original app flow: Message.createMessageFromRto + syncUserSentMessage.
   */
  private createOptimisticUserMessage(messagePayload: OutboundMessagePayload, account: KSDKAccount): KSDKMessage {
    const dto: MessageDto = {
      id: messagePayload.id,
      userMessage: messagePayload.message,
      message: messagePayload.message,
      creationTime: Date.now(),
      type: 'MessageInform',
      inboxId: messagePayload.inboxId,
      sender: {
        id: account.accountId,
        name: account.name
      },
      sessionId: messagePayload.sessionId
    };

    // For optimistic user messages, we only need the first message (no split)
    return this.convertMessageDtoToKSDKMessages(dto)[0];
  }

  /**
   * Send a plain text message from the user.
   * This now implements the same optimistic UI pattern as the original app:
   * - Immediately push a KSDKMessage into the local messages list
   * - Then send the message via WebSocket
   * - When the server echoes the message back, handleIncomingMessages()
   *   will skip it because the IDs match, so we avoid duplicates.
   */
  sendMessage(message: string): void {
    const sessionId = this.getCurrentSessionId();
    const userData = this.getCurrentUserData();

    // Require both user data and session to be available
    if (!userData || !sessionId) {
      return;
    }

    const account: KSDKAccount = {
      accountId: userData.accountId,
      name: userData.name
    };

    // Create the RTO payload (matches original Message.createChatbotRtoMessage)
    const messagePayload = this.createChatbotRtoMessage(sessionId, message, account);

    // Create an optimistic KSDKMessage and push it to the UI immediately
    const optimisticMessage = this.createOptimisticUserMessage(messagePayload, account);
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, optimisticMessage]);

    // Notify that user sent a message (for auto-scroll to bottom)
    this.userSentMessageSubject.next();

    // Start WebSocket loading for response
    this.loadingService.setWebSocketLoading(true, 'Waiting for response...');

    // Send via WebSocket using the same payload so IDs match server echo
    this.sendInboxTextMessageViaWebSocket(sessionId, messagePayload);

    // Show loading indicator
    this.isLoadingSubject.next(true);
  }

  private simulateResponse(_userMessage: string): void {
    // Note: With KSDKMessage class, we don't create mock responses
    // All responses come from the server via WebSocket
  }

  sendInboxTextMessage(sessionId: string, userData: UserData, message: string): Promise<void> {
    // Use the new sendMessage method for consistency
    this.sendMessage(message);

    // Mock implementation - replace with actual API call
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private sendInboxTextMessageViaWebSocket(sessionId: string, messagePayload: OutboundMessagePayload): void {
    const notification: INotificationSignal<OutboundNotificationType> = {
      signal: Signal.notification,
      payload: {
        type: OutboundNotificationType.Message,
        timestamp: Date.now(),
        payload: {
          inboxId: sessionId,
          message: messagePayload,
        },
      },
    };

    this.notificationService.sendNotification(notification);
  }

  private createChatbotRtoMessage(sessionId: string, message: string, sender: KSDKAccount): OutboundMessagePayload {
    // Generate proper message ID in original format: M_<uuid>
    const messageId = this.kristaIdService.createMessageId();

    // Generate proper inbox ID in original format: inbox_S_<sessionId>
    const inboxId = this.kristaIdService.createInboxId(sessionId);

    // Extract the actual session ID without inbox_ prefix to match original app
    // If sessionId already has inbox_ prefix, remove it; otherwise use as-is
    const actualSessionId = sessionId.startsWith('inbox_')
      ? sessionId.replace('inbox_', '')
      : sessionId;

    return {
      sessionId: actualSessionId, // Use session ID without inbox_ prefix to match original
      id: messageId,
      inboxId: inboxId,
      type: WSMessageType.Inform,
      sender: {
        id: sender.accountId,  // Original code uses 'id' not 'accountId'
        name: sender.name
      },
      message: message
    };
  }

  /**
   * Submit form message response - matches original app's submitInboxMessage
   */
  submitFormMessage(messageId: string, formResponse: FormResponse): void {
    const sessionId = this.sessionIdSubject.value;
    if (!sessionId) {
      return;
    }

    // Store the messageId to track which form was submitted
    this.lastSubmittedFormMessageId = messageId;

    // Start WebSocket loading for form submission response
    this.loadingService.setWebSocketLoading(true, 'Processing form submission...');

    // Generate proper inbox ID in original format: inbox_S_<sessionId>
    const inboxId = this.kristaIdService.createInboxId(sessionId);

    // Create form submission notification matching original app format exactly
    const notification: INotificationSignal<OutboundNotificationType> = {
      signal: Signal.notification,
      payload: {
        type: OutboundNotificationType.MessageAnswer,
        timestamp: Date.now(),
        payload: {
          inboxId: inboxId,
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

    this.notificationService.sendNotification(notification);

    // Don't update the message immediately - wait for server response
    // The message will be updated to Answered (right-aligned) when the server responds
    // via handleIncomingMessages() -> convertFormMessageToUserMessage()
  }

  /**
   * Ensure minimum loading time before hiding loader for better UX
   */
  /**
   * For history messages: any MessageAsk that is NOT the last message in the list
   * must have already been answered (conversation continued past it).
   * Create new KSDKMessage instances with MessageType.Answered to hide send button.
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

  private finishLoadingWithMinimumTime(startTime: number, minimumTime: number): void {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, minimumTime - elapsedTime);

    setTimeout(() => {
      this.isLoadingSubject.next(false);
      this.loadingService.setMessageHistoryLoading(false);
    }, remainingTime);
  }
}
