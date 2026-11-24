import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, BehaviorSubject } from 'rxjs';
import { FooterComponent } from './footer.component';
import { ConfigService } from '../../services/config.service';
import { ChatFacade } from '../../core/facades';
import { InternalChatbotConfig, UserData } from '../../models/chatbot.models';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let chatFacadeSpy: jasmine.SpyObj<ChatFacade>;

  const mockConfig: InternalChatbotConfig = {
    config: {
      botName: 'Test Bot',
      botSubTitle: 'Test Subtitle',
      botNamePosition: 'center',
      canChangeLanguage: true,
      hideSendMessage: false,
      TnC: 'https://example.com/terms',
      TnCLabel: 'Terms & Conditions'
    },
    workspaceId: 'workspace-123',
    nodeName: 'test-node',
    languages: [],
    defaultLanguage: 'en',
    theme: { primaryColor: '#000', secondaryColor: '#fff', backgroundColor: '#fff', textColor: '#000', borderRadius: '4px' },
    botName: 'Test Bot',
    botIcon: '/assets/images/krista-logo.svg',
    features: { enableFileUpload: true, enableVoiceInput: false, enableTypingIndicator: true, maxMessageLength: 1000 }
  };

  const mockUserData: UserData = {
    accountId: 'user-123',
    name: 'Test User'
  };

  let mockConfig$: BehaviorSubject<InternalChatbotConfig>;
  let mockSessionId$: BehaviorSubject<string>;
  let mockUserData$: BehaviorSubject<UserData | null>;
  let mockHideFooter$: BehaviorSubject<boolean>;
  let mockIsStatusMode$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    // Reset BehaviorSubjects before each test to avoid state leakage
    mockConfig$ = new BehaviorSubject<InternalChatbotConfig>(mockConfig);
    mockSessionId$ = new BehaviorSubject<string>('session-123');
    mockUserData$ = new BehaviorSubject<UserData | null>(mockUserData);
    mockHideFooter$ = new BehaviorSubject<boolean>(false);
    mockIsStatusMode$ = new BehaviorSubject<boolean>(false);
    const configSpy = jasmine.createSpyObj('ConfigService', ['getCurrentConfig', 'getConfig']);
    const chatFacade = jasmine.createSpyObj('ChatFacade', ['sendMessage'], {
      sessionId$: mockSessionId$.asObservable(),
      userData$: mockUserData$.asObservable(),
      hideFooter$: mockHideFooter$.asObservable(),
      isStatusMode$: mockIsStatusMode$.asObservable()
    });

    configSpy.getCurrentConfig.and.returnValue(mockConfig);
    configSpy.getConfig.and.returnValue(mockConfig$.asObservable());
    chatFacade.sendMessage.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [FooterComponent],
      providers: [
        { provide: ConfigService, useValue: configSpy },
        { provide: ChatFacade, useValue: chatFacade }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    configServiceSpy = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
    chatFacadeSpy = TestBed.inject(ChatFacade) as jasmine.SpyObj<ChatFacade>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have empty value initially', () => {
      expect(component.value).toBe('');
    });

    it('should have empty sessionId initially', () => {
      expect(component.sessionId).toBe('');
    });

    it('should have null userData initially', () => {
      expect(component.userData).toBeNull();
    });

    it('should have hideFooter as false initially', () => {
      expect(component.hideFooter).toBeFalse();
    });

    it('should initialize config from ConfigService', () => {
      expect(component.config).toEqual(mockConfig);
    });
  });

  describe('ngOnInit', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should subscribe to session ID', () => {
      expect(component.sessionId).toBe('session-123');
    });

    it('should subscribe to user data', () => {
      expect(component.userData).toEqual(mockUserData);
    });

    it('should subscribe to hide footer state', () => {
      expect(component.hideFooter).toBeFalse();
    });

    it('should subscribe to config changes', () => {
      expect(component.config).toEqual(mockConfig);
    });
  });

  describe('setValue', () => {
    it('should update value', () => {
      component.setValue('Hello World');
      expect(component.value).toBe('Hello World');
    });

    it('should handle empty string', () => {
      component.setValue('');
      expect(component.value).toBe('');
    });
  });

  describe('handleSendBtnClick', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should not send message when value is empty', () => {
      component.value = '';
      component.handleSendBtnClick();
      expect(chatFacadeSpy.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send message when value is only whitespace', () => {
      component.value = '   ';
      component.handleSendBtnClick();
      expect(chatFacadeSpy.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send message when userData is null', () => {
      mockUserData$.next(null);
      fixture.detectChanges();
      component.value = 'Hello';
      component.handleSendBtnClick();
      expect(chatFacadeSpy.sendMessage).not.toHaveBeenCalled();
    });

    it('should send message when value is valid and userData exists', () => {
      fixture.detectChanges(); // Initialize subscriptions
      component.value = 'Hello World';
      component.handleSendBtnClick();
      expect(chatFacadeSpy.sendMessage).toHaveBeenCalled();
    });

    it('should clear value after sending', fakeAsync(() => {
      component.value = 'Hello World';
      component.handleSendBtnClick();
      tick();
      expect(component.value).toBe('');
    }));
  });

  describe('onEnterKeyPress', () => {
    it('should call handleSendBtnClick', () => {
      spyOn(component, 'handleSendBtnClick');
      component.onEnterKeyPress();
      expect(component.handleSendBtnClick).toHaveBeenCalled();
    });
  });

  describe('onKeyDown', () => {
    it('should call onEnterKeyPress when Enter is pressed without Shift', () => {
      spyOn(component, 'onEnterKeyPress');
      const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false });
      spyOn(event, 'preventDefault');
      component.onKeyDown(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.onEnterKeyPress).toHaveBeenCalled();
    });

    it('should not call onEnterKeyPress when Shift+Enter is pressed', () => {
      spyOn(component, 'onEnterKeyPress');
      const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
      component.onKeyDown(event);
      expect(component.onEnterKeyPress).not.toHaveBeenCalled();
    });

    it('should not call onEnterKeyPress for other keys', () => {
      spyOn(component, 'onEnterKeyPress');
      const event = new KeyboardEvent('keydown', { key: 'a' });
      component.onKeyDown(event);
      expect(component.onEnterKeyPress).not.toHaveBeenCalled();
    });
  });

  describe('onSend', () => {
    it('should call handleSendBtnClick', () => {
      spyOn(component, 'handleSendBtnClick');
      component.onSend();
      expect(component.handleSendBtnClick).toHaveBeenCalled();
    });
  });

  describe('isDisabled getter', () => {
    it('should return true when value is empty', () => {
      component.value = '';
      expect(component.isDisabled).toBeTrue();
    });

    it('should return true when isStatusMode is true (status inform)', () => {
      component.value = 'Hello';
      component.isStatusMode = true;
      expect(component.isDisabled).toBeTrue();
    });

    it('should return false when value exists and isStatusMode is false', () => {
      component.value = 'Hello';
      component.isStatusMode = false;
      expect(component.isDisabled).toBeFalse();
    });
  });

  describe('hideSendMessage getter', () => {
    it('should return true when config.hideSendMessage is true', () => {
      component.config = {
        ...mockConfig,
        config: { ...mockConfig.config, hideSendMessage: true }
      };
      expect(component.hideSendMessage).toBeTrue();
    });

    it('should return false when config.hideSendMessage is false', () => {
      expect(component.hideSendMessage).toBeFalse();
    });
  });

  describe('Terms and Conditions', () => {
    it('should show terms and conditions when TnC is set', () => {
      expect(component.showTermsAndConditions).toBeTrue();
    });

    it('should not show terms and conditions when TnC is empty', () => {
      component.config = {
        ...mockConfig,
        config: { ...mockConfig.config, TnC: '' }
      };
      expect(component.showTermsAndConditions).toBeFalse();
    });

    it('should return correct custom terms label when set', () => {
      component.config = {
        ...mockConfig,
        config: { ...mockConfig.config, TnCLabel: 'Custom Terms' }
      };
      expect(component.customTermsLabel).toBe('Custom Terms');
    });

    it('should return null when TnCLabel is not set', () => {
      component.config = {
        ...mockConfig,
        config: { ...mockConfig.config, TnCLabel: '' }
      };
      expect(component.customTermsLabel).toBeNull();
    });

    it('should return correct terms and conditions URL', () => {
      expect(component.termsAndConditionsUrl).toBe('https://example.com/terms');
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

  describe('Subscription Updates', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should update sessionId when observable emits', () => {
      mockSessionId$.next('new-session-456');
      expect(component.sessionId).toBe('new-session-456');
    });

    it('should update userData when observable emits', () => {
      const newUserData = { accountId: 'user-456', name: 'New User' };
      mockUserData$.next(newUserData);
      expect(component.userData).toEqual(newUserData);
    });

    it('should update hideFooter when observable emits', () => {
      mockHideFooter$.next(true);
      expect(component.hideFooter).toBeTrue();
    });

    it('should update config when observable emits', () => {
      const newConfig = {
        ...mockConfig,
        config: { ...mockConfig.config, botName: 'New Bot' }
      };
      mockConfig$.next(newConfig);
      expect(component.config.config.botName).toBe('New Bot');
    });
  });
});

