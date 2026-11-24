import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageBubbleComponent } from './message-bubble.component';
import { ChatFacade } from '../../core/facades';
import { KristaFieldService } from '../../services/krista-field.service';
import { ConfigApiService } from '../../services/config-api.service';
import { KSDKMessage, MessageType } from '../../../ui-toolkit-src-angular';
import { SubmitType } from '../../models/message.model';
import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

// Mock pipe for fullDateTime
@Pipe({ name: 'fullDateTime', standalone: false })
class MockFullDateTimePipe implements PipeTransform {
  transform(value: any): string {
    return value ? new Date(value).toLocaleString() : '';
  }
}

describe('MessageBubbleComponent', () => {
  let component: MessageBubbleComponent;
  let fixture: ComponentFixture<MessageBubbleComponent>;
  let chatFacadeSpy: jasmine.SpyObj<ChatFacade>;
  let kristaFieldServiceSpy: jasmine.SpyObj<KristaFieldService>;

  const createMockMessage = (overrides: Partial<KSDKMessage> = {}): KSDKMessage => {
    return {
      id: 'msg-123',
      uniqueKey: 'msg-123',
      userMessage: 'Test message',
      message: 'Test message',
      isIncoming: true,
      messageType: MessageType.Inform,
      getCreationTime: () => Date.now(),
      getId: () => 'msg-123',
      form: undefined,
      authentication: undefined,
      responder: undefined,
      isSystemEventMessage: false,
      ...overrides
    } as KSDKMessage;
  };

  beforeEach(async () => {
    const chatFacade = jasmine.createSpyObj('ChatFacade', ['submitForm']);
    const kristaFieldSpy = jasmine.createSpyObj('KristaFieldService', ['getKristaValue']);
    const configApiSpy = jasmine.createSpyObj('ConfigApiService', ['getConfiguration', 'getSupportedLanguages']);

    kristaFieldSpy.getKristaValue.and.callFake((field: any, value: any) => value);
    configApiSpy.getConfiguration.and.returnValue(of({}));
    configApiSpy.getSupportedLanguages.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [MessageBubbleComponent, MockFullDateTimePipe],
      providers: [
        { provide: ChatFacade, useValue: chatFacade },
        { provide: KristaFieldService, useValue: kristaFieldSpy },
        { provide: ConfigApiService, useValue: configApiSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(MessageBubbleComponent);
    component = fixture.componentInstance;
    chatFacadeSpy = TestBed.inject(ChatFacade) as jasmine.SpyObj<ChatFacade>;
    kristaFieldServiceSpy = TestBed.inject(KristaFieldService) as jasmine.SpyObj<KristaFieldService>;

    // Set default message
    component.message = createMockMessage();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Input Properties', () => {
    it('should accept message input', () => {
      const message = createMockMessage({ id: 'custom-msg' });
      component.message = message;
      expect(component.message.id).toBe('custom-msg');
    });

    it('should accept topicId input', () => {
      component.topicId = 'topic-123';
      expect(component.topicId).toBe('topic-123');
    });

    it('should accept isWelcomeMessage input', () => {
      component.isWelcomeMessage = true;
      expect(component.isWelcomeMessage).toBeTrue();
    });

    it('should have default topicId as empty string', () => {
      expect(component.topicId).toBe('');
    });

    it('should have default isWelcomeMessage as false', () => {
      expect(component.isWelcomeMessage).toBeFalse();
    });
  });

  describe('isUserMessage getter', () => {
    it('should return true when message is not incoming', () => {
      component.message = createMockMessage({ isIncoming: false });
      expect(component.isUserMessage).toBeTrue();
    });

    it('should return false when message is incoming', () => {
      component.message = createMockMessage({ isIncoming: true });
      expect(component.isUserMessage).toBeFalse();
    });
  });

  describe('isBotMessage getter', () => {
    it('should return true when message is incoming', () => {
      component.message = createMockMessage({ isIncoming: true });
      expect(component.isBotMessage).toBeTrue();
    });

    it('should return false when message is not incoming', () => {
      component.message = createMockMessage({ isIncoming: false });
      expect(component.isBotMessage).toBeFalse();
    });
  });

  describe('hasForm getter', () => {
    it('should return true when message has form with pages', () => {
      component.message = createMockMessage({
        form: { pages: [{ fields: [] }] }
      });
      expect(component.hasForm).toBeTrue();
    });

    it('should return false when message has no form', () => {
      component.message = createMockMessage({ form: undefined });
      expect(component.hasForm).toBeFalse();
    });

    it('should return true when a form object exists even with no pages', () => {
      component.message = createMockMessage({
        form: { pages: [] }
      });
      expect(component.hasForm).toBeTrue();
    });
  });

  describe('messageContent getter', () => {
    it('should return userMessage when available', () => {
      component.message = createMockMessage({
        userMessage: 'User message',
        message: 'Bot message'
      });
      expect(component.messageContent).toBe('User message');
    });

    it('should return message when userMessage is not available', () => {
      component.message = createMockMessage({
        userMessage: '',
        message: 'Bot message'
      });
      expect(component.messageContent).toBe('Bot message');
    });

    it('should return empty string when both are empty', () => {
      component.message = createMockMessage({
        userMessage: '',
        message: ''
      });
      expect(component.messageContent).toBe('');
    });
  });

  describe('isAuthenticationMessage getter', () => {
    it('should return true when message has authentication', () => {
      component.message = createMockMessage({
        authentication: { authUrl: 'https://auth.example.com', systemName: 'TestSystem' }
      });
      expect(component.isAuthenticationMessage).toBeTrue();
    });

    it('should return false when message has no authentication', () => {
      component.message = createMockMessage({ authentication: undefined });
      expect(component.isAuthenticationMessage).toBeFalse();
    });
  });

  describe('isResponseAckMessage getter', () => {
    it('should return true when message has responder', () => {
      component.message = createMockMessage({
        responder: { name: 'Test Responder' }
      });
      expect(component.isResponseAckMessage).toBeTrue();
    });

    it('should return false when message has no responder', () => {
      component.message = createMockMessage({ responder: undefined });
      expect(component.isResponseAckMessage).toBeFalse();
    });
  });

  describe('isSystemEventMessage getter', () => {
    it('should return true when message is system event', () => {
      component.message = createMockMessage({ isSystemEventMessage: true });
      expect(component.isSystemEventMessage).toBeTrue();
    });

    it('should return false when message is not system event', () => {
      component.message = createMockMessage({ isSystemEventMessage: false });
      expect(component.isSystemEventMessage).toBeFalse();
    });
  });

  describe('isTextMessage getter', () => {
    it('should return true for plain text message', () => {
      component.message = createMockMessage({
        form: undefined,
        authentication: undefined,
        responder: undefined,
        isSystemEventMessage: false
      });
      expect(component.isTextMessage).toBeTrue();
    });

    it('should return false when message has form', () => {
      component.message = createMockMessage({
        form: { pages: [{ fields: [] }] }
      });
      expect(component.isTextMessage).toBeFalse();
    });

    it('should return false when message has authentication', () => {
      component.message = createMockMessage({
        authentication: { authUrl: 'https://auth.example.com', systemName: 'TestSystem' }
      });
      expect(component.isTextMessage).toBeFalse();
    });
  });



  describe('openAuthUrl', () => {
    it('should open auth URL in new window', () => {
      spyOn(window, 'open');
      component.openAuthUrl('https://auth.example.com');
      expect(window.open).toHaveBeenCalledWith(
        'https://auth.example.com',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should not open window when URL is empty', () => {
      spyOn(window, 'open');
      component.openAuthUrl('');
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('handleAuthClick', () => {
    it('should call openAuthUrl with auth URL', () => {
      spyOn(component, 'openAuthUrl');
      component.message = createMockMessage({
        authentication: { authUrl: 'https://auth.example.com', systemName: 'TestSystem' }
      });
      component.handleAuthClick();
      expect(component.openAuthUrl).toHaveBeenCalledWith('https://auth.example.com');
    });

    it('should not call openAuthUrl when no authentication', () => {
      spyOn(component, 'openAuthUrl');
      component.message = createMockMessage({ authentication: undefined });
      component.handleAuthClick();
      expect(component.openAuthUrl).not.toHaveBeenCalled();
    });
  });

  describe('onSendFormData', () => {
    it('should return false when form is undefined', () => {
      component.message = createMockMessage({ form: undefined });
      const result = component.onSendFormData();
      expect(result).toBeFalse();
    });

    it('should return false when form is readOnly', () => {
      component.message = createMockMessage({
        form: { readOnly: true, pages: [{ fields: [] }] }
      });
      const result = component.onSendFormData();
      expect(result).toBeFalse();
    });

    it('should validate required fields', () => {
      component.message = createMockMessage({
        form: {
          readOnly: false,
          pages: [{
            fields: [{
              fieldId: 'f1',
              name: 'field1',
              required: true,
              value: '',
              fieldType: 'com.krista.fields.Text'
            }]
          }]
        }
      });
      const result = component.onSendFormData();
      expect(result).toBeFalse();
      expect(component.errorFields).toContain('field1');
    });

    it('should submit form when validation passes', () => {
      component.message = createMockMessage({
        id: 'msg-123',
        form: {
          readOnly: false,
          pages: [{
            fields: [{
              fieldId: 'f1',
              name: 'field1',
              required: true,
              value: 'test value',
              fieldType: 'com.krista.fields.Text'
            }]
          }]
        }
      });
      const result = component.onSendFormData();
      expect(result).toBeTrue();
      expect(chatFacadeSpy.submitForm).toHaveBeenCalled();
    });

    it('should skip validation for sidebar submit type', () => {
      component.message = createMockMessage({
        id: 'msg-123',
        form: {
          readOnly: false,
          pages: [{
            fields: [{
              fieldId: 'f1',
              name: 'field1',
              required: true,
              value: '',
              fieldType: 'com.krista.fields.Text'
            }]
          }]
        }
      });
      const result = component.onSendFormData(SubmitType.sidebar);
      expect(result).toBeTrue();
    });
  });
});

