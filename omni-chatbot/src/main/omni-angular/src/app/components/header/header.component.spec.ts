import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, NEVER, of } from 'rxjs';
import { HeaderComponent } from './header.component';
import { HeaderService } from '../../services/header.service';
import { ConfigService } from '../../services/config.service';
import { InternalChatbotConfig } from '../../models/chatbot.models';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let headerServiceSpy: jasmine.SpyObj<HeaderService>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;

  const mockConfig: InternalChatbotConfig = {
    config: {
      botName: 'Test Bot',
      botSubTitle: 'Test Subtitle',
      botNamePosition: 'center',
      canChangeLanguage: false,
      hideSendMessage: false,
      TnC: '',
      TnCLabel: ''
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

  const mockConfig$ = new BehaviorSubject<InternalChatbotConfig>(mockConfig);

  beforeEach(async () => {
    const headerSpy = jasmine.createSpyObj('HeaderService', ['logout'], {
      languages$: of([]),
      selectedLanguage$: of('en')
    });
    const configSpy = jasmine.createSpyObj('ConfigService', ['getCurrentConfig', 'getConfig', 'getChatbotIcon']);

    configSpy.getCurrentConfig.and.returnValue(mockConfig);
    configSpy.getConfig.and.returnValue(mockConfig$.asObservable());
    configSpy.getChatbotIcon.and.returnValue('/assets/images/krista-logo.svg');
    // Use NEVER to prevent the logout callback from executing (which would trigger window.location.reload)
    headerSpy.logout.and.returnValue(NEVER);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [HeaderComponent],
      providers: [
        { provide: HeaderService, useValue: headerSpy },
        { provide: ConfigService, useValue: configSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    headerServiceSpy = TestBed.inject(HeaderService) as jasmine.SpyObj<HeaderService>;
    configServiceSpy = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should initialize with config from ConfigService', () => {
      expect(component.chatbotConfig).toEqual(mockConfig);
    });

    it('should initialize bot name position from config', () => {
      expect(component.botNamePosition).toBe('center');
    });

    it('should initialize chatbot icon from ConfigService', () => {
      expect(component.chatbotIcon).toBe('/assets/images/krista-logo.svg');
    });

    it('should be initialized', () => {
      expect(component.isInitialized).toBeTrue();
    });

    it('should not be reloading initially', () => {
      expect(component.isReloading).toBeFalse();
    });
  });

  describe('Getters', () => {
    it('should return bot name from config', () => {
      expect(component.botName).toBe('Test Bot');
    });

    it('should return default bot name when config is empty', () => {
      component.chatbotConfig = { config: {} } as InternalChatbotConfig;
      expect(component.botName).toBe('Krista');
    });

    it('should return bot subtitle from config', () => {
      expect(component.botSubTitle).toBe('Test Subtitle');
    });

    it('should return empty string when bot subtitle is not set', () => {
      component.chatbotConfig = { config: {} } as InternalChatbotConfig;
      expect(component.botSubTitle).toBe('');
    });
  });

  describe('Start Over / Restart', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should set isReloading to true', () => {
      component.onClickStartOver();
      expect(component.isReloading).toBeTrue();
    });

    it('should call logout service', () => {
      component.onClickStartOver();
      expect(headerServiceSpy.logout).toHaveBeenCalled();
    });

    it('should call onClickStartOver when onRestart is called', () => {
      spyOn(component, 'onClickStartOver');
      component.onRestart();
      expect(component.onClickStartOver).toHaveBeenCalled();
    });

    it('should call logout API and set isReloading when start over is clicked', () => {
      // Use NEVER to prevent the callback from executing (which would trigger window.location.reload)
      headerServiceSpy.logout.and.returnValue(NEVER);

      component.onClickStartOver();

      // Verify logout was called and isReloading is set
      expect(headerServiceSpy.logout).toHaveBeenCalled();
      expect(component.isReloading).toBeTrue();
    });
  });

  describe('Close', () => {
    it('should post message to parent window', () => {
      spyOn(window.parent, 'postMessage');
      component.onCloseClick();
      expect(window.parent.postMessage).toHaveBeenCalledWith(
        '{"messageType": "minimize", "value":true}',
        jasmine.anything()
      );
    });

    it('should call onCloseClick when onClose is called', () => {
      spyOn(component, 'onCloseClick');
      component.onClose();
      expect(component.onCloseClick).toHaveBeenCalled();
    });
  });

  describe('Image Error Handler', () => {
    it('should set fallback image on error', () => {
      const mockEvent = {
        target: { src: '' }
      };
      component.onImageError(mockEvent);
      expect(mockEvent.target.src).toBe('/assets/images/krista-logo.svg');
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

  describe('Config Subscription', () => {
    it('should update chatbotConfig when config changes', fakeAsync(() => {
      fixture.detectChanges();
      const newConfig = {
        ...mockConfig,
        config: { ...mockConfig.config, botName: 'New Bot Name' }
      };
      mockConfig$.next(newConfig);
      tick();
      expect(component.chatbotConfig.config.botName).toBe('New Bot Name');
    }));

    it('should update botNamePosition when config changes', fakeAsync(() => {
      fixture.detectChanges();
      const newConfig = {
        ...mockConfig,
        config: { ...mockConfig.config, botNamePosition: 'left' }
      };
      mockConfig$.next(newConfig);
      tick();
      expect(component.botNamePosition).toBe('left');
    }));
  });
});
