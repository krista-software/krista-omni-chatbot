import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { MessageService } from './message.service';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';
import { SessionService } from './session.service';
import { MessageApiService } from './message-api.service';
import { KristaIdService } from './krista-id.service';
import { MessagesApiService } from './messages-api.service';
import { LoadingService } from './loading.service';
import { MessageType } from '../../ui-toolkit-src-angular';
import { TranslateModule } from '@ngx-translate/core';
import { SubmitType } from '../models/message.model';

describe('MessageService', () => {
  let service: MessageService;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;
  let sessionServiceSpy: jasmine.SpyObj<SessionService>;
  let messageApiServiceSpy: jasmine.SpyObj<MessageApiService>;
  let kristaIdServiceSpy: jasmine.SpyObj<KristaIdService>;
  let messagesApiServiceSpy: jasmine.SpyObj<MessagesApiService>;
  let loadingServiceSpy: jasmine.SpyObj<LoadingService>;

  beforeEach(() => {
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['receiveNotification', 'sendNotification']);
    const storageSpy = jasmine.createSpyObj('StorageService', ['getItem', 'setItem']);
    const sessionSpy = jasmine.createSpyObj('SessionService', ['getSession']);
    const messageApiSpy = jasmine.createSpyObj('MessageApiService', ['getMessages']);
    const kristaIdSpy = jasmine.createSpyObj('KristaIdService', ['createMessageId', 'createInboxId']);
    const messagesApiSpy = jasmine.createSpyObj('MessagesApiService', ['getInitialMessages', 'getOlderMessages']);
    const loadingSpy = jasmine.createSpyObj('LoadingService', ['setMessageHistoryLoading', 'setWebSocketLoading']);

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        MessageService,
        { provide: NotificationService, useValue: notificationSpy },
        { provide: StorageService, useValue: storageSpy },
        { provide: SessionService, useValue: sessionSpy },
        { provide: MessageApiService, useValue: messageApiSpy },
        { provide: KristaIdService, useValue: kristaIdSpy },
        { provide: MessagesApiService, useValue: messagesApiSpy },
        { provide: LoadingService, useValue: loadingSpy }
      ]
    });

    service = TestBed.inject(MessageService);
    notificationServiceSpy = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    storageServiceSpy = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    sessionServiceSpy = TestBed.inject(SessionService) as jasmine.SpyObj<SessionService>;
    messageApiServiceSpy = TestBed.inject(MessageApiService) as jasmine.SpyObj<MessageApiService>;
    kristaIdServiceSpy = TestBed.inject(KristaIdService) as jasmine.SpyObj<KristaIdService>;
    messagesApiServiceSpy = TestBed.inject(MessagesApiService) as jasmine.SpyObj<MessagesApiService>;
    loadingServiceSpy = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have empty session ID initially', () => {
      expect(service.getCurrentSessionId()).toBe('');
    });

    it('should have null user data initially', () => {
      expect(service.getCurrentUserData()).toBeNull();
    });

    it('should have hideFooter as false initially', () => {
      expect(service.getCurrentHideFooter()).toBeFalse();
    });
  });

  describe('Session Management', () => {
    it('should set session ID', () => {
      service.setSessionId('test-session-123');
      expect(service.getCurrentSessionId()).toBe('test-session-123');
    });

    it('should emit session ID via observable', (done) => {
      service.getSessionId().subscribe(sessionId => {
        if (sessionId === 'test-session-456') {
          expect(sessionId).toBe('test-session-456');
          done();
        }
      });
      service.setSessionId('test-session-456');
    });
  });

  describe('User Data Management', () => {
    it('should set user data', () => {
      const userData = { accountId: 'user-123', name: 'Test User' };
      service.setUserData(userData);
      expect(service.getCurrentUserData()).toEqual(userData);
    });

    it('should emit user data via observable', (done) => {
      const userData = { accountId: 'user-456', name: 'Another User' };
      service.getUserData().subscribe(data => {
        if (data?.accountId === 'user-456') {
          expect(data).toEqual(userData);
          done();
        }
      });
      service.setUserData(userData);
    });
  });

  describe('Hide Footer Management', () => {
    it('should set hide footer state', () => {
      service.setHideFooter(true);
      expect(service.getCurrentHideFooter()).toBeTrue();
    });

    it('should emit hide footer state via observable', (done) => {
      service.getHideFooter().subscribe(hideFooter => {
        if (hideFooter) {
          expect(hideFooter).toBeTrue();
          done();
        }
      });
      service.setHideFooter(true);
    });
  });

  describe('Message Loading', () => {
    it('should call loading service when loading message history', fakeAsync(() => {
      const mockResponse = { messages: [], hasMore: false };
      messagesApiServiceSpy.getInitialMessages.and.returnValue(of(mockResponse));

      service.loadMessageHistory('inbox-123');
      tick(2000);

      // TranslateModule.forRoot() returns the key when no translations are loaded
      expect(loadingServiceSpy.setMessageHistoryLoading).toHaveBeenCalledWith(true, 'initializerProvider.loadingConversationHistory');
    }));

    it('should process messages from API response', fakeAsync(() => {
      const mockMessages = [
        {
          id: 'msg-1',
          userMessage: 'Hello',
          message: 'Hello',
          creationTime: Date.now(),
          type: 'MessageInform' as const,
          sender: { id: 'user-1', name: 'User' }
        }
      ];
      const mockResponse = { messages: mockMessages, hasMore: false };
      messagesApiServiceSpy.getInitialMessages.and.returnValue(of(mockResponse));
      messagesApiServiceSpy.getOlderMessages.and.returnValue(of({ messages: [], hasMore: false }));

      let receivedMessages: any[] = [];
      service.messages$.subscribe(messages => {
        receivedMessages = messages;
      });

      service.loadMessageHistory('inbox-123');
      tick(2000);

      expect(receivedMessages.length).toBe(1);
    }));
  });

  describe('Send Message', () => {
    beforeEach(() => {
      kristaIdServiceSpy.createMessageId.and.returnValue('M_test-uuid');
      kristaIdServiceSpy.createInboxId.and.returnValue('inbox_S_session-123');
    });

    it('should not send message without user data', () => {
      service.setSessionId('session-123');
      service.sendMessage('Hello');
      expect(notificationServiceSpy.sendNotification).not.toHaveBeenCalled();
    });

    it('should not send message without session ID', () => {
      service.setUserData({ accountId: 'user-123', name: 'Test User' });
      service.sendMessage('Hello');
      expect(notificationServiceSpy.sendNotification).not.toHaveBeenCalled();
    });

    it('should send message when user data and session are available', () => {
      service.setSessionId('session-123');
      service.setUserData({ accountId: 'user-123', name: 'Test User' });
      service.sendMessage('Hello');
      expect(notificationServiceSpy.sendNotification).toHaveBeenCalled();
    });

    it('should add optimistic message to messages list', () => {
      service.setSessionId('session-123');
      service.setUserData({ accountId: 'user-123', name: 'Test User' });

      let messages: any[] = [];
      service.messages$.subscribe(m => messages = m);

      service.sendMessage('Hello');

      expect(messages.length).toBe(1);
      expect(messages[0].userMessage).toBe('Hello');
    });

    it('should emit userSentMessage event', (done) => {
      service.setSessionId('session-123');
      service.setUserData({ accountId: 'user-123', name: 'Test User' });

      // userSentMessage$ is a Subject<void>; asserting the emitted value both documents
      // that contract and stops Jasmine reporting this spec as having no expectations
      // (which reads like a false green in the build log).
      service.userSentMessage$.subscribe((emitted) => {
        expect(emitted).toBeUndefined();
        done();
      });

      service.sendMessage('Hello');
    });

    it('should set WebSocket loading state', () => {
      service.setSessionId('session-123');
      service.setUserData({ accountId: 'user-123', name: 'Test User' });
      service.sendMessage('Hello');
      expect(loadingServiceSpy.setWebSocketLoading).toHaveBeenCalledWith(true, 'Waiting for response...');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const result = service.escapeHtml('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should handle empty string', () => {
      const result = service.escapeHtml('');
      expect(result).toBe('');
    });

    it('should handle plain text without special characters', () => {
      const result = service.escapeHtml('Hello World');
      expect(result).toBe('Hello World');
    });
  });

  describe('Message Type Update', () => {
    it('should update message type to answered', () => {
      service.setSessionId('session-123');
      service.setUserData({ accountId: 'user-123', name: 'Test User' });
      kristaIdServiceSpy.createMessageId.and.returnValue('M_test-uuid');
      kristaIdServiceSpy.createInboxId.and.returnValue('inbox_S_session-123');

      // Add a message first
      service.sendMessage('Hello');

      let messages: any[] = [];
      service.messages$.subscribe(m => messages = m);

      // Update the message type
      service.updateMessageTypeToAnswered('M_test-uuid');

      expect(messages.length).toBe(1);
      expect(messages[0].messageType).toBe(MessageType.Answered);
    });

    it('should not update non-existent message', () => {
      let messages: any[] = [];
      service.messages$.subscribe(m => messages = m);

      service.updateMessageTypeToAnswered('non-existent-id');

      expect(messages.length).toBe(0);
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      kristaIdServiceSpy.createInboxId.and.returnValue('inbox_S_session-123');
    });

    it('should not submit form without session ID', () => {
      service.submitFormMessage('msg-123', { values: {}, submitType: SubmitType.submit, submitValue: 'Submit' });
      expect(notificationServiceSpy.sendNotification).not.toHaveBeenCalled();
    });

    it('should submit form when session is available', () => {
      service.setSessionId('session-123');
      service.submitFormMessage('msg-123', { values: { field1: 'value1' }, submitType: SubmitType.submit, submitValue: 'Submit' });
      expect(notificationServiceSpy.sendNotification).toHaveBeenCalled();
    });

    it('should set WebSocket loading state on form submission', () => {
      service.setSessionId('session-123');
      service.submitFormMessage('msg-123', { values: {}, submitType: SubmitType.submit, submitValue: 'Submit' });
      expect(loadingServiceSpy.setWebSocketLoading).toHaveBeenCalledWith(true, 'Processing form submission...');
    });
  });
});

