import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { InternalChatbotConfig } from '../models/chatbot.models';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfigService]
    });
    service = TestBed.inject(ConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getCurrentConfig', () => {
    it('should return the current config', () => {
      const config = service.getCurrentConfig();
      expect(config).toBeDefined();
      expect(config.workspaceId).toBe('default-workspace');
      expect(config.nodeName).toBe('default-node');
    });
  });

  describe('updateConfig', () => {
    it('should update config with partial config', (done) => {
      const partialConfig: Partial<InternalChatbotConfig> = {
        botName: 'Updated Bot'
      };

      service.updateConfig(partialConfig);

      service.config$.subscribe(config => {
        expect(config.botName).toBe('Updated Bot');
        done();
      });
    });

    it('should handle API config format with restartOnRefresh', (done) => {
      const apiConfig = {
        workspaceId: 'new-workspace',
        nodeName: 'new-node',
        config: {
          botName: 'API Bot',
          restartOnRefresh: true
        }
      };

      service.updateConfig(apiConfig);

      service.config$.subscribe(config => {
        expect(config.workspaceId).toBe('new-workspace');
        expect(config.nodeName).toBe('new-node');
        expect(config.config?.['restartOnRefresh']).toBe(true);
        done();
      });
    });

    describe('canChangeLanguage', () => {
      it('should be true only when both canChangeLanguage and isMultilingualEnabled are true', (done) => {
        const apiConfig = {
          workspaceId: 'ws',
          nodeName: 'node',
          isMultilingualEnabled: true,
          config: { canChangeLanguage: true }
        };
        service.updateConfig(apiConfig);
        service.config$.subscribe(config => {
          expect(config.config?.canChangeLanguage).toBe(true);
          done();
        });
      });

      it('should be false when config is empty even if isMultilingualEnabled is true', (done) => {
        const apiConfig = {
          workspaceId: 'ws',
          nodeName: 'node',
          isMultilingualEnabled: true,
          config: {}
        };
        service.updateConfig(apiConfig);
        service.config$.subscribe(config => {
          expect(config.config?.canChangeLanguage).toBe(false);
          done();
        });
      });

      it('should be false when canChangeLanguage is false even if isMultilingualEnabled is true', (done) => {
        const apiConfig = {
          workspaceId: 'ws',
          nodeName: 'node',
          isMultilingualEnabled: true,
          config: { canChangeLanguage: false }
        };
        service.updateConfig(apiConfig);
        service.config$.subscribe(config => {
          expect(config.config?.canChangeLanguage).toBe(false);
          done();
        });
      });

      it('should be false when isMultilingualEnabled is false even if canChangeLanguage is true', (done) => {
        const apiConfig = {
          workspaceId: 'ws',
          nodeName: 'node',
          isMultilingualEnabled: false,
          config: { canChangeLanguage: true }
        };
        service.updateConfig(apiConfig);
        service.config$.subscribe(config => {
          expect(config.config?.canChangeLanguage).toBe(false);
          done();
        });
      });

      it('should be false when isMultilingualEnabled is undefined', (done) => {
        const apiConfig = {
          workspaceId: 'ws',
          nodeName: 'node',
          config: { canChangeLanguage: true }
        };
        service.updateConfig(apiConfig);
        service.config$.subscribe(config => {
          expect(config.config?.canChangeLanguage).toBe(false);
          done();
        });
      });
    });
  });

  describe('setToolkitCallback', () => {
    it('should set the toolkit callback', () => {
      const mockCallback = jasmine.createSpy('callback');

      service.setToolkitCallback(mockCallback);

      const toolkitConfig = service.getToolkitConfig();
      expect(toolkitConfig.callback).toBe(mockCallback);
    });

    it('should allow callback to be invoked', () => {
      const mockCallback = jasmine.createSpy('callback');
      service.setToolkitCallback(mockCallback);

      const toolkitConfig = service.getToolkitConfig();
      toolkitConfig.callback('testEvent', { data: 'test' });

      expect(mockCallback).toHaveBeenCalledWith('testEvent', { data: 'test' });
    });

    it('should update callback when set multiple times', () => {
      const firstCallback = jasmine.createSpy('firstCallback');
      const secondCallback = jasmine.createSpy('secondCallback');

      service.setToolkitCallback(firstCallback);
      service.setToolkitCallback(secondCallback);

      const toolkitConfig = service.getToolkitConfig();
      toolkitConfig.callback('testEvent');

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledWith('testEvent');
    });
  });

  describe('getToolkitConfig', () => {
    it('should return toolkit config with workspaceId and nodeName', () => {
      const toolkitConfig = service.getToolkitConfig();

      expect(toolkitConfig.workspaceId).toBe('default-workspace');
      expect(toolkitConfig.nodeName).toBe('default-node');
    });

    it('should include callback in toolkit config if set', () => {
      const mockCallback = jasmine.createSpy('callback');
      service.setToolkitCallback(mockCallback);

      const toolkitConfig = service.getToolkitConfig();

      expect(toolkitConfig.callback).toBeDefined();
      expect(toolkitConfig.callback).toBe(mockCallback);
    });

    it('should return null callback if not set', () => {
      const toolkitConfig = service.getToolkitConfig();

      expect(toolkitConfig.callback).toBeNull();
    });
  });

  describe('getChatbotIcon', () => {
    it('should return the default Krista icon path', () => {
      const icon = service.getChatbotIcon();
      expect(icon).toBe('/assets/images/krista-icon.svg');
    });

    it('should extract the mediaId from an "icon:svg:<id>&mediaId=<mediaId>" value', () => {
      localStorage.setItem('krista_chatbot_clientSessionId', 'test-session');
      service.updateConfig({
        workspaceId: 'ws_98f1a670',
        icon: 'icon:svg:IC_1037&mediaId=icon_IC_1037.svg'
      } as Partial<InternalChatbotConfig>);

      const icon = service.getChatbotIcon();

      expect(icon).toContain('/media/workspaces/ws_98f1a670/icon_IC_1037.svg');
      expect(icon).not.toContain('icon:svg:');
      expect(icon).not.toContain('mediaId=');
      localStorage.removeItem('krista_chatbot_clientSessionId');
    });

    it('should strip the "media:" prefix from a media-backed icon', () => {
      localStorage.setItem('krista_chatbot_clientSessionId', 'test-session');
      service.updateConfig({
        workspaceId: 'ws_98f1a670',
        icon: 'media:icon_IC_1037.svg'
      } as Partial<InternalChatbotConfig>);

      const icon = service.getChatbotIcon();

      expect(icon).toContain('/media/workspaces/ws_98f1a670/icon_IC_1037.svg');
      localStorage.removeItem('krista_chatbot_clientSessionId');
    });

    it('should return a non-media icon (font/local/raw) verbatim, not as a media URL', () => {
      localStorage.setItem('krista_chatbot_clientSessionId', 'test-session');
      service.updateConfig({
        workspaceId: 'ws_98f1a670',
        icon: 'icon:fontawesome:fa-bolt&fontSet=fas'
      } as Partial<InternalChatbotConfig>);

      const icon = service.getChatbotIcon();

      expect(icon).toBe('icon:fontawesome:fa-bolt&fontSet=fas');
      expect(icon).not.toContain('/media/workspaces/');
      localStorage.removeItem('krista_chatbot_clientSessionId');
    });
  });

  describe('initializeConfig', () => {
    it('should initialize without errors', () => {
      expect(() => service.initializeConfig()).not.toThrow();
    });
  });
});

