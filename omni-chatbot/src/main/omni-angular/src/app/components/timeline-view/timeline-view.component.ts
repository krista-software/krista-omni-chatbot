import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChatFacade } from '../../core/facades';
import { LoadingService } from '../../services/loading.service';

// Import from UI Toolkit (will be replaced by library in future)
import { KSDKMessage, MessageType, KristaId, KSDKMedia } from '../../../ui-toolkit-src-angular';
import { MessagesApiService, MessageDto } from '../../services/messages-api.service';
import { LoadingVariant } from '../shared/loading/loading.component';

@Component({
  selector: 'app-timeline-view',
  standalone: false,
  templateUrl: './timeline-view.component.html',
  styleUrl: './timeline-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineViewComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() topicId: string = '';
  @Input() messages: KSDKMessage[] = [];
  @Input() isLoading: boolean = false;
  @Input() unreadMessageId: string = '';
  @Output() sidebarClick = new EventEmitter<any>();

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLElement>;

  // state properties
  newIncomingMessages = false;
  atBottom = true;
  preventAutoScroll = false;
  forceScrollToBottom = false;
  fetchingPrevMessages = false;
  // Initially true to show loader until first message arrives (matches original app line 94)
  fetchingNextMessages = true;
  isWelcomeMessage = false;
  isTyping = false;

  // Status inform step state
  isStatusMode = false;
  statusMessages: string[] = [];
  statusImage: string | null = null;
  // Once the session times out the footer stays hidden for the rest of the page
  // lifetime. Mirrors the irreversible isSessionTimedOut flag in chat state.
  private isSessionTimedOut = false;

  // Pagination properties
  private oldestMessageId: string | undefined;
  private isLoadingOlderMessages = false;
  private hasMoreOlderMessages = true;
  private previousMessageCount = 0;
  private scrollHandler: (() => void) | null = null;
  private initialLoadComplete = false; // Track if initial load is done for smooth scrolling
  // True when the login response flagged this as a brand-new chatbot session. Brand-new
  // sessions have no server-side message history, so the only entries in chat state are
  // the client-injected welcome bubble plus messages pushed by the live Welcome Conversation.
  // Using those synthetic IDs as a pagination offset against /messages produces an empty
  // response, so scroll-up pagination is suppressed for the lifetime of a "new" session.
  // After page refresh the session is no longer "new" and pagination works normally.
  private isNewSession = false;
  // True once the message-history load has actually begun. Used to clear the initial
  // inline loader (fetchingNextMessages) when that load completes even with ZERO
  // messages — otherwise a returning user whose /messages response is empty spins
  // forever, since fetchingNextMessages is only cleared on first-message-arrival.
  // Guarded on "started" so a brand-new session (which never loads history and keeps
  // the loader until the welcome message arrives) is unaffected.
  private messageHistoryLoadStarted = false;

  private destroy$ = new Subject<void>();

  // Expose LoadingVariant for template
  LoadingVariant = LoadingVariant;

  constructor(
    private chatFacade: ChatFacade,
    public loadingService: LoadingService,
    private messagesApiService: MessagesApiService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Track the brand-new-session flag (sourced from the login response extras) so that
    // scroll-up pagination can be suppressed on first-ever sessions. See isNewSession field.
    this.chatFacade.userData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.isNewSession = !!user?.extras?.newSession;
      });

    // Session timeout: hide the footer permanently once the session has timed out.
    this.chatFacade.isSessionTimedOut$
      .pipe(takeUntil(this.destroy$))
      .subscribe(timedOut => {
        this.isSessionTimedOut = timedOut;
        if (timedOut) {
          this.chatFacade.setHideFooter(true);
        }
        this.cdr.markForCheck();
      });

    // Server-driven typing indicator (matches original: SyncMessageService.registerStateNotification)
    this.chatFacade.isTyping$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isTyping: boolean) => {
        this.isTyping = isTyping;
        this.cdr.markForCheck();
        // Keep typing bubble visible if user is already pinned to bottom
        if (isTyping && this.atBottom) {
          setTimeout(() => this.scrollToBottom(), 50);
        }
      });

    // Client-driven typing indicator (fires immediately on send/submit, before server isTyping arrives)
    this.loadingService.isWebSocketLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isLoading: boolean) => {
        if (isLoading && this.atBottom) {
          setTimeout(() => this.scrollToBottom(), 50);
        }
      });

    // Subscribe to user sent message event - force scroll to bottom when user sends a message
    this.chatFacade.userSentMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.forceScrollToBottom = true;
        setTimeout(() => this.scrollToBottom(), 100);
        this.cdr.markForCheck();
      });

    // Subscribe to status mode from state — source of truth for the overlay.
    this.chatFacade.isStatusMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isStatusMode => {
        this.isStatusMode = isStatusMode;
        if (!isStatusMode) {
          this.statusMessages = [];
          this.statusImage = null;
        }
        this.cdr.markForCheck();
      });

    this.chatFacade.statusMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.statusMessages = messages;
        this.cdr.markForCheck();
      });

    this.chatFacade.statusImage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(image => {
        this.statusImage = image;
        this.cdr.markForCheck();
      });

    // Subscribe to new messages from WebSocket
    this.chatFacade.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        const isInitialLoad = this.previousMessageCount === 0 && messages.length > 0;
        const hasNewMessages = messages.length > this.previousMessageCount;

        // Stop showing loader when first message arrives (matches original app behavior)
        if (isInitialLoad) {
          this.fetchingNextMessages = false;
          // Mark as welcome message when first messages arrive (matches original: setIsWelcomeMessage(msgs.length === 0))
          this.isWelcomeMessage = true;
        }

        // Check if new messages arrived (compare with tracked count)
        if (hasNewMessages) {
          this.newIncomingMessages = true;

          // For initial load OR if user is at bottom OR force scroll is enabled - scroll to bottom
          if (isInitialLoad || this.atBottom || this.forceScrollToBottom) {
            // Use multiple timeouts to ensure scroll happens after DOM update
            // Longer delays for initial load to ensure all messages are rendered
            if (isInitialLoad) {
              setTimeout(() => this.scrollToBottom(), 100);
              setTimeout(() => this.scrollToBottom(), 300);
              setTimeout(() => this.scrollToBottom(), 500);
            } else {
              setTimeout(() => this.scrollToBottom(), 50);
              setTimeout(() => this.scrollToBottom(), 150);
            }
          }
        }

        // Hide footer if the last message is "MessageAsk" and the form is active (not readonly)
        // This matches the original app behavior. Status inform is deliberately NOT included:
        // it disables the footer in place (setStatusMode) so there is no layout shift.
        if (messages && messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          const shouldHideFooter = lastMessage.messageType === MessageType.Ask &&
            (!lastMessage.form || !lastMessage.form.readOnly);
          this.chatFacade.setHideFooter(shouldHideFooter || this.isSessionTimedOut);
        }

        // Update tracked count
        this.previousMessageCount = messages.length;
        this.cdr.markForCheck();
      });

    // Subscribe to loading state changes - scroll to bottom when loading completes
    this.loadingService.isMessageHistoryLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoading => {
        if (isLoading) {
          this.messageHistoryLoadStarted = true;
        } else if (this.messageHistoryLoadStarted) {
          // History load finished (with or without messages): clear the initial
          // inline loader so a returning user with an empty history is not left
          // on a spinner forever.
          this.fetchingNextMessages = false;
          this.cdr.markForCheck();
        }
        // When message history loading completes, scroll to bottom with retries
        if (!isLoading && this.messages.length > 0) {
          // Multiple attempts to ensure scroll happens after DOM is fully rendered
          // Include longer delays to catch late-rendering content (forms, images, etc.)
          this.scrollToBottomWithRetry(5, 100);
          setTimeout(() => this.scrollToBottom(), 500);
          setTimeout(() => this.scrollToBottom(), 1000);
          setTimeout(() => {
            this.scrollToBottom();
            // Mark initial load as complete after final scroll - enable smooth scrolling for future scrolls
            this.initialLoadComplete = true;
          }, 2000);
        }
      });
  }

  /**
   * Scroll to bottom with retry mechanism
   * Retries multiple times to ensure container is visible and rendered
   */
  private scrollToBottomWithRetry(retries: number, delay: number): void {
    if (retries <= 0) return;

    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container && container.scrollHeight > 0 && container.offsetHeight > 0) {
        container.scrollTop = container.scrollHeight;
        this.newIncomingMessages = false;
        this.atBottom = true;
        this.forceScrollToBottom = false;
        this.cdr.markForCheck();
      } else {
        // Retry if container not ready
        this.scrollToBottomWithRetry(retries - 1, delay * 1.5);
      }
    }, delay);
  }

  ngAfterViewInit(): void {
    // Set up scroll event handling for the messages container
    if (this.messagesContainer?.nativeElement) {
      const container = this.messagesContainer.nativeElement;
      this.scrollHandler = () => {
        this.ngZone.run(() => {
          this.onScroll(container);
        });
      };
      container.addEventListener('scroll', this.scrollHandler);

      // Initial scroll to bottom after view init
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  ngOnDestroy(): void {
    // Clean up scroll event listener
    if (this.scrollHandler && this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.removeEventListener('scroll', this.scrollHandler);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSidebarClick(event: any): void {
    this.sidebarClick.emit(event);
  }

  trackByMessageId(index: number, message: KSDKMessage): string {
    return message.id || index.toString();
  }

  /**
   * Scroll to the bottom of the messages container
   * Uses requestAnimationFrame to ensure DOM is fully rendered
   * Uses smooth scrolling after initial load is complete
   */
  scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (this.messagesContainer?.nativeElement) {
        const container = this.messagesContainer.nativeElement;
        // Check if container is visible and has content
        if (container.scrollHeight > 0 && container.offsetHeight > 0) {
          // Use smooth scrolling only after initial load is complete
          if (this.initialLoadComplete) {
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'smooth'
            });
            // Don't reset atBottom/newIncomingMessages immediately —
            // let the onScroll handler detect arrival at bottom naturally
            // so the button stays visible during the smooth animation.
            this.forceScrollToBottom = false;
          } else {
            // Instant scroll during initial load to avoid interference
            container.scrollTop = container.scrollHeight;
            this.newIncomingMessages = false;
            this.atBottom = true;
            this.forceScrollToBottom = false;
            this.cdr.markForCheck();
          }
        }
      }
    });
  }

  /**
   * Handle scroll events on the messages container
   */
  private onScroll(container: HTMLElement): void {
    const threshold = 50; // pixels from bottom to consider "at bottom"
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Check if at bottom
    const atBottom = scrollHeight - scrollTop - clientHeight <= threshold;
    if (atBottom !== this.atBottom) {
      this.atBottom = atBottom;
      if (atBottom) {
        this.newIncomingMessages = false;
      }
      this.cdr.markForCheck();
    }

    // Check if at top - load older messages
    if (scrollTop <= threshold && !this.isLoadingOlderMessages && this.hasMoreOlderMessages && this.messages.length > 0) {
      this.loadOlderMessages();
    }
  }

  /**
   * Load older messages when user scrolls to the top
   * Matches original app behavior with negative page size and offset
   */
  private loadOlderMessages(): void {
    // Skip for brand-new sessions: there's no server-side history to page through, and the
    // only entries in chat state are client-injected/welcome-conversation bubbles whose IDs
    // would produce an empty response if used as the /messages offset.
    if (this.isLoadingOlderMessages || !this.hasMoreOlderMessages || this.isNewSession) {
      return;
    }

    this.isLoadingOlderMessages = true;
    this.fetchingPrevMessages = true;
    this.cdr.markForCheck();

    // Get the oldest message ID for offset (first message in the list)
    const offset = this.messages.length > 0 ? this.messages[0].id : undefined;

    // Extract inbox ID from the first message - use the topicId as inbox ID
    const inboxId = this.topicId || '';

    if (!inboxId) {
      this.isLoadingOlderMessages = false;
      this.fetchingPrevMessages = false;
      return;
    }

    this.messagesApiService.getOlderMessages(inboxId, offset)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.messages && response.messages.length > 0) {
            // Convert API messages to KSDKMessage format
            const olderMessages: KSDKMessage[] = response.messages.map((msg: MessageDto) => {
              // Determine message type from type field
              let messageType = MessageType.Inform;
              if (msg.type === 'MessageAsk') {
                messageType = MessageType.Ask;
              } else if (msg.type === 'MessageAnswered') {
                messageType = MessageType.Answered;
              }

              // Convert MediaDto to KSDKMedia[] if present
              const media: KSDKMedia[] | undefined = msg.media ? [msg.media as KSDKMedia] : undefined;

              // Create KSDKMessage using basic properties
              return new KSDKMessage(
                msg.id,                                    // messageId
                messageType,                               // messageType
                undefined as unknown as KristaId,          // inboxId
                msg.creationTime || Date.now(),           // creationTime
                msg.sender || { id: '', name: '' },       // senderAccount
                msg.userMessage || msg.message || '',     // userMessage
                media,                                     // media (converted to array)
                undefined,                                 // form
                undefined,                                 // submit
                msg.executionMeta ? { executionId: msg.executionMeta.executionId, title: msg.executionMeta.title || '' } : undefined, // executionMeta
                undefined,                                 // paths
                undefined,                                 // sideConversations
                undefined,                                 // targetAudience
                msg.timer ? { startTime: msg.timer.startTime, endTime: msg.timer.endTime } : undefined, // timer
                undefined,                                 // sessionId
                undefined,                                 // copies
                msg.responder ? { sidebars: undefined, name: msg.responder.name } : undefined, // responder
                msg.authentication ? { authUrl: msg.authentication.authUrl, systemName: msg.authentication.systemName || '' } : undefined, // authentication
                msg.systemEventType as 'join-task' | 'leave-task' | undefined, // systemEventType
                msg.systemEventData as { account: { name: string; _id: string }; activeParticipantCounts: number } | undefined // systemEventData
              );
            });

            // Store current scroll index before adding messages
            const previousMessageCount = this.messages.length;

            // Remove duplicates: filter out messages that already exist in this.messages
            const uniqueOlderMessages = olderMessages.filter(olderMsg => {
              return !this.messages.some(existingMsg => existingMsg.id === olderMsg.id);
            });
            const newMessagesCount = uniqueOlderMessages.length;

            // Add only unique older messages to the beginning
            this.messages = [...uniqueOlderMessages, ...this.messages];

            // Scroll to maintain user's view position
            setTimeout(() => {
              if (this.messagesContainer?.nativeElement) {
                // Calculate approximate scroll position to maintain view
                const container = this.messagesContainer.nativeElement;
                const estimatedNewHeight = newMessagesCount * 100; // Approximate height per message
                container.scrollTop = estimatedNewHeight;
              }
            }, 0);

            // Check if there are more messages to load
            this.hasMoreOlderMessages = response.messages.length === 20;
          } else {
            this.hasMoreOlderMessages = false;
          }

          this.isLoadingOlderMessages = false;
          this.fetchingPrevMessages = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading older messages:', error);
          this.isLoadingOlderMessages = false;
          this.fetchingPrevMessages = false;
          this.cdr.markForCheck();
        }
      });
  }
}
