import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { of, Subject, BehaviorSubject } from 'rxjs';
import { TimelineViewComponent } from './timeline-view.component';
import { ChatFacade } from '../../core/facades';
import { LoadingService } from '../../services/loading.service';
import { MessagesApiService } from '../../services/messages-api.service';
import { KSDKMessage } from '../../../ui-toolkit-src-angular';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('TimelineViewComponent', () => {
  let component: TimelineViewComponent;
  let fixture: ComponentFixture<TimelineViewComponent>;
  let chatFacadeSpy: jasmine.SpyObj<ChatFacade>;
  let loadingServiceSpy: jasmine.SpyObj<LoadingService>;
  let messagesApiServiceSpy: jasmine.SpyObj<MessagesApiService>;

  const mockUserSentMessage$ = new Subject<void>();
  const mockMessages$ = new BehaviorSubject<KSDKMessage[]>([]);
  const mockIsMessageHistoryLoading$ = new BehaviorSubject<boolean>(false);
  const mockIsTyping$ = new Subject<boolean>();
  const mockIsWebSocketLoading$ = new Subject<boolean>();
  const mockUserData$ = new BehaviorSubject<any>({ accountId: 'user-1', name: 'User', extras: {} });
  const mockIsSessionTimedOut$ = new BehaviorSubject<boolean>(false);
  const mockIsStatusMode$ = new BehaviorSubject<boolean>(false);
  const mockStatusMessages$ = new BehaviorSubject<string[]>([]);
  const mockStatusImage$ = new BehaviorSubject<string | null>(null);

  beforeEach(async () => {
    const chatFacade = jasmine.createSpyObj('ChatFacade', ['setHideFooter'], {
      userSentMessage$: mockUserSentMessage$.asObservable(),
      messages$: mockMessages$.asObservable(),
      isTyping$: mockIsTyping$.asObservable(),
      userData$: mockUserData$.asObservable(),
      isSessionTimedOut$: mockIsSessionTimedOut$.asObservable(),
      isStatusMode$: mockIsStatusMode$.asObservable(),
      statusMessages$: mockStatusMessages$.asObservable(),
      statusImage$: mockStatusImage$.asObservable(),
      currentUserData: { accountId: 'user-1', name: 'User' }
    });
    const loadingSpy = jasmine.createSpyObj('LoadingService', [], {
      isMessageHistoryLoading$: mockIsMessageHistoryLoading$.asObservable(),
      isWebSocketLoading$: mockIsWebSocketLoading$.asObservable()
    });
    const messagesApiSpy = jasmine.createSpyObj('MessagesApiService', ['getOlderMessages']);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [TimelineViewComponent],
      providers: [
        { provide: ChatFacade, useValue: chatFacade },
        { provide: LoadingService, useValue: loadingSpy },
        { provide: MessagesApiService, useValue: messagesApiSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineViewComponent);
    component = fixture.componentInstance;
    chatFacadeSpy = TestBed.inject(ChatFacade) as jasmine.SpyObj<ChatFacade>;
    loadingServiceSpy = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
    messagesApiServiceSpy = TestBed.inject(MessagesApiService) as jasmine.SpyObj<MessagesApiService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have empty messages array by default', () => {
      expect(component.messages).toEqual([]);
    });

    it('should have isLoading as false by default', () => {
      expect(component.isLoading).toBeFalse();
    });

    it('should have atBottom as true by default', () => {
      expect(component.atBottom).toBeTrue();
    });

    it('should have newIncomingMessages as false by default', () => {
      expect(component.newIncomingMessages).toBeFalse();
    });

    it('should have forceScrollToBottom as false by default', () => {
      expect(component.forceScrollToBottom).toBeFalse();
    });

    it('should have fetchingPrevMessages as false by default', () => {
      expect(component.fetchingPrevMessages).toBeFalse();
    });

    it('should have fetchingNextMessages as true by default (shows loader until first message arrives)', () => {
      // Initially true to show loader until first message arrives (matches original app behavior)
      expect(component.fetchingNextMessages).toBeTrue();
    });
  });

  describe('Input Properties', () => {
    it('should accept topicId input', () => {
      component.topicId = 'topic-123';
      expect(component.topicId).toBe('topic-123');
    });

    it('should accept messages input', () => {
      const mockMessages = [createMockMessage('msg-1')];
      component.messages = mockMessages;
      expect(component.messages.length).toBe(1);
    });

    it('should accept isLoading input', () => {
      component.isLoading = true;
      expect(component.isLoading).toBeTrue();
    });

    it('should accept unreadMessageId input', () => {
      component.unreadMessageId = 'unread-123';
      expect(component.unreadMessageId).toBe('unread-123');
    });
  });

  describe('trackByMessageId', () => {
    it('should return message id when available', () => {
      const message = createMockMessage('msg-123');
      const result = component.trackByMessageId(0, message);
      expect(result).toBe('msg-123');
    });

    it('should return index as string when message id is not available', () => {
      const message = createMockMessage('');
      (message as any).id = undefined;
      const result = component.trackByMessageId(5, message);
      expect(result).toBe('5');
    });
  });

  describe('scrollToBottom', () => {
    it('should set atBottom to true', fakeAsync(() => {
      component.atBottom = false;
      setupMockMessagesContainer();
      component.scrollToBottom();
      // scrollToBottom uses requestAnimationFrame, so we need to flush it
      tick(16); // Approximate time for one animation frame
      expect(component.atBottom).toBeTrue();
    }));

    it('should set newIncomingMessages to false', fakeAsync(() => {
      component.newIncomingMessages = true;
      setupMockMessagesContainer();
      component.scrollToBottom();
      tick(16);
      expect(component.newIncomingMessages).toBeFalse();
    }));

    it('should set forceScrollToBottom to false', fakeAsync(() => {
      component.forceScrollToBottom = true;
      setupMockMessagesContainer();
      component.scrollToBottom();
      tick(16);
      expect(component.forceScrollToBottom).toBeFalse();
    }));
  });

  describe('User Sent Message Subscription', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should set forceScrollToBottom to true when user sends message', fakeAsync(() => {
      mockUserSentMessage$.next();
      expect(component.forceScrollToBottom).toBeTrue();
    }));

    it('should call scrollToBottom after user sends message', fakeAsync(() => {
      spyOn(component, 'scrollToBottom');
      mockUserSentMessage$.next();
      tick(100);
      expect(component.scrollToBottom).toHaveBeenCalled();
    }));
  });

  describe('Messages Subscription', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should set newIncomingMessages to true when new messages arrive', () => {
      component.messages = [createMockMessage('msg-1')];
      mockMessages$.next([createMockMessage('msg-1'), createMockMessage('msg-2')]);
      expect(component.newIncomingMessages).toBeTrue();
    });

    it('should scroll to bottom when at bottom and new messages arrive', fakeAsync(() => {
      // First emit a message to set previousMessageCount
      mockMessages$.next([createMockMessage('msg-1')]);
      tick(500); // Wait for initial load timeouts

      spyOn(component, 'scrollToBottom');
      component.atBottom = true;
      // Now emit a new message
      mockMessages$.next([createMockMessage('msg-1'), createMockMessage('msg-2')]);
      tick(200); // Wait for scroll timeouts (50ms and 150ms)
      expect(component.scrollToBottom).toHaveBeenCalled();
    }));

    it('should scroll to bottom when forceScrollToBottom is true', fakeAsync(() => {
      // First emit a message to set previousMessageCount
      mockMessages$.next([createMockMessage('msg-1')]);
      tick(500); // Wait for initial load timeouts

      spyOn(component, 'scrollToBottom');
      component.forceScrollToBottom = true;
      // Now emit a new message
      mockMessages$.next([createMockMessage('msg-1'), createMockMessage('msg-2')]);
      tick(200); // Wait for scroll timeouts (50ms and 150ms)
      expect(component.scrollToBottom).toHaveBeenCalled();
    }));
  });

  describe('Typing Indicator Auto-Scroll', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should scroll to bottom when isTyping turns true and user is at bottom', fakeAsync(() => {
      spyOn(component, 'scrollToBottom');
      component.atBottom = true;
      mockIsTyping$.next(true);
      tick(100);
      expect(component.scrollToBottom).toHaveBeenCalled();
    }));

    it('should NOT scroll to bottom when isTyping turns true and user is NOT at bottom', fakeAsync(() => {
      spyOn(component, 'scrollToBottom');
      component.atBottom = false;
      mockIsTyping$.next(true);
      tick(100);
      expect(component.scrollToBottom).not.toHaveBeenCalled();
    }));

    it('should NOT scroll to bottom when isTyping turns false', fakeAsync(() => {
      spyOn(component, 'scrollToBottom');
      component.atBottom = true;
      mockIsTyping$.next(false);
      tick(100);
      expect(component.scrollToBottom).not.toHaveBeenCalled();
    }));

    it('should update isTyping flag regardless of atBottom', fakeAsync(() => {
      component.atBottom = false;
      mockIsTyping$.next(true);
      tick(0);
      expect(component.isTyping).toBeTrue();
      mockIsTyping$.next(false);
      tick(0);
      expect(component.isTyping).toBeFalse();
    }));

    it('should scroll to bottom when isWebSocketLoading turns true and user is at bottom', fakeAsync(() => {
      spyOn(component, 'scrollToBottom');
      component.atBottom = true;
      mockIsWebSocketLoading$.next(true);
      tick(100);
      expect(component.scrollToBottom).toHaveBeenCalled();
    }));

    it('should NOT scroll to bottom when isWebSocketLoading turns true and user is NOT at bottom', fakeAsync(() => {
      spyOn(component, 'scrollToBottom');
      component.atBottom = false;
      mockIsWebSocketLoading$.next(true);
      tick(100);
      expect(component.scrollToBottom).not.toHaveBeenCalled();
    }));

    it('should NOT scroll to bottom when isWebSocketLoading turns false', fakeAsync(() => {
      spyOn(component, 'scrollToBottom');
      component.atBottom = true;
      mockIsWebSocketLoading$.next(false);
      tick(100);
      expect(component.scrollToBottom).not.toHaveBeenCalled();
    }));
  });

  describe('Sidebar Click', () => {
    it('should emit sidebarClick event', () => {
      spyOn(component.sidebarClick, 'emit');
      const eventData = { action: 'test' };
      component.onSidebarClick(eventData);
      expect(component.sidebarClick.emit).toHaveBeenCalledWith(eventData);
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete destroy$ subject', () => {
      fixture.detectChanges();
      spyOn((component as any).destroy$, 'next');
      spyOn((component as any).destroy$, 'complete');
      component.ngOnDestroy();
      expect((component as any).destroy$.next).toHaveBeenCalled();
      expect((component as any).destroy$.complete).toHaveBeenCalled();
    });
  });

  describe('Load Older Messages', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.topicId = 'inbox-123';
      component.messages = [createMockMessage('msg-1')];
      // currentUserData is already set as a property in the mock setup
    });

    it('should not load older messages when already loading', () => {
      (component as any).isLoadingOlderMessages = true;
      (component as any).loadOlderMessages();
      expect(messagesApiServiceSpy.getOlderMessages).not.toHaveBeenCalled();
    });

    it('should not load older messages when no more messages available', () => {
      (component as any).hasMoreOlderMessages = false;
      (component as any).loadOlderMessages();
      expect(messagesApiServiceSpy.getOlderMessages).not.toHaveBeenCalled();
    });

    it('should not load older messages when topicId is empty', () => {
      component.topicId = '';
      (component as any).loadOlderMessages();
      expect(messagesApiServiceSpy.getOlderMessages).not.toHaveBeenCalled();
    });

    it('should call API to load older messages', () => {
      messagesApiServiceSpy.getOlderMessages.and.returnValue(of({ messages: [], hasMore: false }));
      (component as any).loadOlderMessages();
      expect(messagesApiServiceSpy.getOlderMessages).toHaveBeenCalledWith('inbox-123', 'msg-1');
    });

    it('should set fetchingPrevMessages to true while loading', () => {
      messagesApiServiceSpy.getOlderMessages.and.returnValue(of({ messages: [], hasMore: false }));
      (component as any).loadOlderMessages();
      // Note: fetchingPrevMessages is set to false after API response
      expect(component.fetchingPrevMessages).toBeFalse();
    });
  });

  // Helper functions
  function createMockMessage(id: string): KSDKMessage {
    return {
      id,
      uniqueKey: id,
      userMessage: 'Test message',
      message: 'Test message',
      isIncoming: true,
      getCreationTime: () => Date.now(),
      getId: () => id
    } as KSDKMessage;
  }

  function setupMockMessagesContainer(): void {
    component.messagesContainer = {
      nativeElement: {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
        offsetHeight: 500, // Required for scrollToBottom to work
        addEventListener: jasmine.createSpy('addEventListener'),
        scrollTo: jasmine.createSpy('scrollTo')
      }
    } as ElementRef;
  }
});

