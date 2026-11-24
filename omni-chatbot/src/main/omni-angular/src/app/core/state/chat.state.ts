import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { KSDKMessage } from '../../../ui-toolkit-src-angular';
import { UserData } from '../../models/config.model';

/**
 * Chat State Interface
 * Represents the complete state of the chat application
 */
export interface ChatState {
  // Session state
  sessionId: string;
  inboxId: string;

  // User state
  userData: UserData | null;

  // Messages state
  messages: KSDKMessage[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;

  // UI state
  hideFooter: boolean;
  isTyping: boolean;

  // Session timeout state (irreversible once set)
  isSessionTimedOut: boolean;

  // Agentic/chat mode state
  isConversationExecuting: boolean;

  // Status inform state
  isStatusMode: boolean;
  statusMessages: string[];
  statusMessage: string;
  statusImage: string | null;

  // Error state
  error: string | null;
}

/**
 * Initial state
 */
const INITIAL_STATE: ChatState = {
  sessionId: '',
  inboxId: '',
  userData: null,
  messages: [],
  isLoadingMessages: false,
  hasMoreMessages: false,
  hideFooter: false,
  isTyping: false,
  isSessionTimedOut: false,
  isConversationExecuting: false,
  isStatusMode: false,
  statusMessages: [],
  statusMessage: '',
  statusImage: null,
  error: null
};

/**
 * Chat State Service
 *
 * Centralized state management for the chat application.
 * Provides a single source of truth for all chat-related state.
 *
 * Benefits:
 * - Centralized state management
 * - Memoized selectors for performance
 * - Easy debugging with single state object
 * - Follows Observer Pattern
 */
@Injectable({
  providedIn: 'root'
})
export class ChatStateService {
  private readonly state$ = new BehaviorSubject<ChatState>(INITIAL_STATE);

  // ============================================================================
  // Selectors (memoized observables)
  // ============================================================================

  /**
   * Select the full state (use sparingly)
   */
  readonly fullState$: Observable<ChatState> = this.state$.asObservable();

  /**
   * Select session ID
   */
  readonly sessionId$: Observable<string> = this.state$.pipe(
    map(state => state.sessionId),
    distinctUntilChanged()
  );

  /**
   * Select inbox ID
   */
  readonly inboxId$: Observable<string> = this.state$.pipe(
    map(state => state.inboxId),
    distinctUntilChanged()
  );

  /**
   * Select user data
   */
  readonly userData$: Observable<UserData | null> = this.state$.pipe(
    map(state => state.userData),
    distinctUntilChanged()
  );

  /**
   * Select messages
   */
  readonly messages$: Observable<KSDKMessage[]> = this.state$.pipe(
    map(state => state.messages),
    distinctUntilChanged()
  );

  /**
   * Select loading state
   */
  readonly isLoadingMessages$: Observable<boolean> = this.state$.pipe(
    map(state => state.isLoadingMessages),
    distinctUntilChanged()
  );

  /**
   * Select hide footer state
   */
  readonly hideFooter$: Observable<boolean> = this.state$.pipe(
    map(state => state.hideFooter),
    distinctUntilChanged()
  );

  /**
   * Select session timed out flag
   */
  readonly isSessionTimedOut$: Observable<boolean> = this.state$.pipe(
    map(state => state.isSessionTimedOut),
    distinctUntilChanged()
  );

  /**
   * Select status mode flag
   */
  readonly isStatusMode$: Observable<boolean> = this.state$.pipe(
    map(state => state.isStatusMode),
    distinctUntilChanged()
  );

  /**
   * Select status messages array
   */
  readonly statusMessages$: Observable<string[]> = this.state$.pipe(
    map(state => state.statusMessages),
    // Compare by VALUE, not reference: setStatusMode builds a fresh array on every
    // status tick, so a plain distinctUntilChanged (===) would re-emit an identical
    // list and make the status overlay restart/jump. Only emit on real content change.
    distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i]))
  );

  readonly statusImage$: Observable<string | null> = this.state$.pipe(
    map(state => state.statusImage),
    distinctUntilChanged()
  );

  /**
   * Select error state
   */
  readonly error$: Observable<string | null> = this.state$.pipe(
    map(state => state.error),
    distinctUntilChanged()
  );

  // ============================================================================
  // Snapshot getters (for synchronous access)
  // ============================================================================

  get currentState(): ChatState {
    return this.state$.value;
  }

  get sessionId(): string {
    return this.state$.value.sessionId;
  }

  get inboxId(): string {
    return this.state$.value.inboxId;
  }

  get messages(): KSDKMessage[] {
    return this.state$.value.messages;
  }

  get isConversationExecuting(): boolean {
    return this.state$.value.isConversationExecuting;
  }

  // ============================================================================
  // Actions (state mutations)
  // ============================================================================

  /**
   * Set session ID
   */
  setSessionId(sessionId: string): void {
    this.updateState({ sessionId });
  }

  /**
   * Set inbox ID
   */
  setInboxId(inboxId: string): void {
    this.updateState({ inboxId });
  }

  /**
   * Set user data
   */
  setUserData(userData: UserData | null): void {
    this.updateState({ userData });
  }

  /**
   * Set messages (replace all)
   */
  setMessages(messages: KSDKMessage[]): void {
    this.updateState({ messages });
  }

  /**
   * Add a message to the end
   */
  addMessage(message: KSDKMessage): void {
    this.updateState({
      messages: [...this.state$.value.messages, message]
    });
  }

  /**
   * Add messages to the beginning (for loading older messages)
   */
  prependMessages(messages: KSDKMessage[]): void {
    this.updateState({
      messages: [...messages, ...this.state$.value.messages]
    });
  }

  /**
   * Update a specific message
   * Note: This creates a new KSDKMessage instance to maintain proper class methods
   */
  updateMessage(messageId: string, updates: Partial<KSDKMessage>): void {
    const messages = this.state$.value.messages.map(msg => {
      if (msg.id !== messageId) return msg;
      // Apply updates to the existing message object
      Object.assign(msg, updates);
      return msg;
    });
    this.updateState({ messages: messages as KSDKMessage[] });
  }

  /**
   * Remove a message
   */
  removeMessage(messageId: string): void {
    const messages = this.state$.value.messages.filter(msg => msg.id !== messageId);
    this.updateState({ messages });
  }

  /**
   * Set loading state
   */
  setLoadingMessages(isLoading: boolean): void {
    this.updateState({ isLoadingMessages: isLoading });
  }

  /**
   * Set hide footer state.
   * No-op if the session has timed out — that state is irreversible, so the
   * footer must stay hidden even if a later message subscription tries to show it.
   */
  setHideFooter(hide: boolean): void {
    if (this.state$.value.isSessionTimedOut) return;
    this.updateState({ hideFooter: hide });
  }

  /**
   * Set typing indicator
   */
  setTyping(isTyping: boolean): void {
    this.updateState({ isTyping });
  }

  /**
   * Set conversation executing state
   */
  setConversationExecuting(executing: boolean): void {
    this.updateState({ isConversationExecuting: executing });
  }

  /**
   * Set session timed out (irreversible). Also hides the footer.
   */
  setSessionTimedOut(): void {
    this.updateState({ isSessionTimedOut: true, hideFooter: true });
  }

  /**
   * Set error
   */
  setError(error: string | null): void {
    this.updateState({ error });
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.updateState({ error: null });
  }

  /**
   * Activate status mode with the provided messages
   */
  setStatusMode(messages: string[], imageUrl: string | null = null): void {
    this.updateState({
      isStatusMode: true,
      statusMessages: messages,
      statusMessage: messages.length > 0 ? messages[0] : '',
      statusImage: imageUrl
    });
  }

  /**
   * Deactivate status mode and clear status messages
   */
  clearStatusMode(): void {
    this.updateState({
      isStatusMode: false,
      statusMessages: [],
      statusMessage: '',
      statusImage: null
    });
  }

  /**
   * Reset state to initial
   */
  reset(): void {
    this.state$.next(INITIAL_STATE);
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Update state with partial updates
   */
  private updateState(partial: Partial<ChatState>): void {
    this.state$.next({
      ...this.state$.value,
      ...partial
    });
  }
}

