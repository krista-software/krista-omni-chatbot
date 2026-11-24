import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoadingService]
    });
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have isLoading as false initially', () => {
      expect(service.isLoading).toBeFalse();
    });

    it('should have isInitialLoading as false initially', () => {
      expect(service.isInitialLoading).toBeFalse();
    });

    it('should have isWebSocketLoading as false initially', () => {
      expect(service.isWebSocketLoading).toBeFalse();
    });

    it('should have isAuthLoading as false initially', () => {
      expect(service.isAuthLoading).toBeFalse();
    });

    it('should have isSessionLoading as false initially', () => {
      expect(service.isSessionLoading).toBeFalse();
    });

    it('should have isConfigLoading as false initially', () => {
      expect(service.isConfigLoading).toBeFalse();
    });

    it('should have isMessageHistoryLoading as false initially', () => {
      expect(service.isMessageHistoryLoading).toBeFalse();
    });

    it('should have default loading message', () => {
      expect(service.loadingMessage).toBe('Loading...');
    });

    it('should have isAnyLoading as false initially', () => {
      expect(service.isAnyLoading).toBeFalse();
    });
  });

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      service.setLoading(true);
      expect(service.isLoading).toBeTrue();
    });

    it('should set loading state to false', () => {
      service.setLoading(true);
      service.setLoading(false);
      expect(service.isLoading).toBeFalse();
    });

    it('should update loading message when provided', () => {
      service.setLoading(true, 'Custom loading message');
      expect(service.loadingMessage).toBe('Custom loading message');
    });

    it('should not update loading message when not provided', () => {
      service.setLoading(true, 'First message');
      service.setLoading(false);
      expect(service.loadingMessage).toBe('First message');
    });

    it('should emit loading state via observable', (done) => {
      service.isLoading$.subscribe(isLoading => {
        if (isLoading) {
          expect(isLoading).toBeTrue();
          done();
        }
      });
      service.setLoading(true);
    });
  });

  describe('setInitialLoading', () => {
    it('should set initial loading state to true', () => {
      service.setInitialLoading(true);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should set initial loading state to false', () => {
      service.setInitialLoading(true);
      service.setInitialLoading(false);
      expect(service.isInitialLoading).toBeFalse();
    });

    it('should update loading message when provided', () => {
      service.setInitialLoading(true, 'Initializing...');
      expect(service.loadingMessage).toBe('Initializing...');
    });

    it('should emit initial loading state via observable', (done) => {
      service.isInitialLoading$.subscribe(isLoading => {
        if (isLoading) {
          expect(isLoading).toBeTrue();
          done();
        }
      });
      service.setInitialLoading(true);
    });
  });

  describe('setWebSocketLoading', () => {
    it('should set WebSocket loading state to true', () => {
      service.setWebSocketLoading(true);
      expect(service.isWebSocketLoading).toBeTrue();
    });

    it('should set WebSocket loading state to false', () => {
      service.setWebSocketLoading(true);
      service.setWebSocketLoading(false);
      expect(service.isWebSocketLoading).toBeFalse();
    });

    it('should update loading message when provided', () => {
      service.setWebSocketLoading(true, 'Connecting...');
      expect(service.loadingMessage).toBe('Connecting...');
    });

    it('should emit WebSocket loading state via observable', (done) => {
      service.isWebSocketLoading$.subscribe(isLoading => {
        if (isLoading) {
          expect(isLoading).toBeTrue();
          done();
        }
      });
      service.setWebSocketLoading(true);
    });
  });

  describe('setAuthLoading', () => {
    it('should set auth loading state to true', () => {
      service.setAuthLoading(true);
      expect(service.isAuthLoading).toBeTrue();
    });

    it('should set auth loading state to false', () => {
      service.setAuthLoading(true);
      service.setAuthLoading(false);
      expect(service.isAuthLoading).toBeFalse();
    });

    it('should update initial loading state when auth loading changes', () => {
      service.setAuthLoading(true);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should clear initial loading when auth loading is false and no other initial loaders', () => {
      service.setAuthLoading(true);
      service.setAuthLoading(false);
      expect(service.isInitialLoading).toBeFalse();
    });

    it('should emit auth loading state via observable', (done) => {
      service.isAuthLoading$.subscribe(isLoading => {
        if (isLoading) {
          expect(isLoading).toBeTrue();
          done();
        }
      });
      service.setAuthLoading(true);
    });
  });

  describe('setSessionLoading', () => {
    it('should set session loading state to true', () => {
      service.setSessionLoading(true);
      expect(service.isSessionLoading).toBeTrue();
    });

    it('should set session loading state to false', () => {
      service.setSessionLoading(true);
      service.setSessionLoading(false);
      expect(service.isSessionLoading).toBeFalse();
    });

    it('should update initial loading state when session loading changes', () => {
      service.setSessionLoading(true);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should emit session loading state via observable', (done) => {
      service.isSessionLoading$.subscribe(isLoading => {
        if (isLoading) {
          expect(isLoading).toBeTrue();
          done();
        }
      });
      service.setSessionLoading(true);
    });
  });

  describe('setConfigLoading', () => {
    it('should set config loading state to true', () => {
      service.setConfigLoading(true);
      expect(service.isConfigLoading).toBeTrue();
    });

    it('should set config loading state to false', () => {
      service.setConfigLoading(true);
      service.setConfigLoading(false);
      expect(service.isConfigLoading).toBeFalse();
    });

    it('should update initial loading state when config loading changes', () => {
      service.setConfigLoading(true);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should emit config loading state via observable', (done) => {
      service.isConfigLoading$.subscribe(isLoading => {
        if (isLoading) {
          expect(isLoading).toBeTrue();
          done();
        }
      });
      service.setConfigLoading(true);
    });
  });

  describe('setMessageHistoryLoading', () => {
    it('should set message history loading state to true', () => {
      service.setMessageHistoryLoading(true);
      expect(service.isMessageHistoryLoading).toBeTrue();
    });

    it('should set message history loading state to false', () => {
      service.setMessageHistoryLoading(true);
      service.setMessageHistoryLoading(false);
      expect(service.isMessageHistoryLoading).toBeFalse();
    });

    it('should update loading message when provided', () => {
      service.setMessageHistoryLoading(true, 'Loading messages...');
      expect(service.loadingMessage).toBe('Loading messages...');
    });

    it('should emit message history loading state via observable', (done) => {
      service.isMessageHistoryLoading$.subscribe(isLoading => {
        if (isLoading) {
          expect(isLoading).toBeTrue();
          done();
        }
      });
      service.setMessageHistoryLoading(true);
    });
  });

  describe('isAnyLoading', () => {
    it('should return true when isLoading is true', () => {
      service.setLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });

    it('should return true when isInitialLoading is true', () => {
      service.setInitialLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });

    it('should return true when isWebSocketLoading is true', () => {
      service.setWebSocketLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });

    it('should return true when isAuthLoading is true', () => {
      service.setAuthLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });

    it('should return true when isSessionLoading is true', () => {
      service.setSessionLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });

    it('should return true when isConfigLoading is true', () => {
      service.setConfigLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });

    it('should return true when isMessageHistoryLoading is true', () => {
      service.setMessageHistoryLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });

    it('should return false when all loading states are false', () => {
      expect(service.isAnyLoading).toBeFalse();
    });

    it('should return true when multiple loading states are true', () => {
      service.setLoading(true);
      service.setWebSocketLoading(true);
      expect(service.isAnyLoading).toBeTrue();
    });
  });

  describe('updateInitialLoadingState', () => {
    it('should set initial loading to true when config is loading', () => {
      service.setConfigLoading(true);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should set initial loading to true when auth is loading', () => {
      service.setAuthLoading(true);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should set initial loading to true when session is loading', () => {
      service.setSessionLoading(true);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should keep initial loading true when one of config/auth/session is still loading', () => {
      service.setConfigLoading(true);
      service.setAuthLoading(true);
      service.setConfigLoading(false);
      expect(service.isInitialLoading).toBeTrue();
    });

    it('should set initial loading to false when all config/auth/session are done', () => {
      service.setConfigLoading(true);
      service.setAuthLoading(true);
      service.setSessionLoading(true);
      service.setConfigLoading(false);
      service.setAuthLoading(false);
      service.setSessionLoading(false);
      expect(service.isInitialLoading).toBeFalse();
    });
  });
});

