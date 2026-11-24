import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, BehaviorSubject, Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { AppFacade } from './core/facades';
import { WebSocketHandlerService } from './services/websocket-handler.service';
import { KSDKMessage } from '../ui-toolkit-src-angular';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let appFacadeSpy: jasmine.SpyObj<AppFacade>;

  // BehaviorSubjects for reactive state
  let messagesSubject: BehaviorSubject<KSDKMessage[]>;
  let isLoadingSubject: BehaviorSubject<boolean>;
  let sessionIdSubject: BehaviorSubject<string>;
  let hideHeaderSubject: Subject<boolean>;
  let hideSendMessageSubject: Subject<boolean>;
  let bootFailedSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    // Initialize subjects
    messagesSubject = new BehaviorSubject<KSDKMessage[]>([]);
    isLoadingSubject = new BehaviorSubject<boolean>(false);
    sessionIdSubject = new BehaviorSubject<string>('');
    hideHeaderSubject = new Subject<boolean>();
    hideSendMessageSubject = new Subject<boolean>();
    bootFailedSubject = new BehaviorSubject<boolean>(false);

    // Create spy object for AppFacade
    appFacadeSpy = jasmine.createSpyObj('AppFacade', [
      'initialize',
      'destroy',
      'onSidebarClick',
      'sendMessage',
      'closeChatWindow',
      'onIdleStillHere',
      'reconnectAfterInactivity',
      'retryBoot'
    ], {
      messages$: messagesSubject.asObservable(),
      isLoading$: isLoadingSubject.asObservable(),
      sessionId$: sessionIdSubject.asObservable(),
      hideHeader$: hideHeaderSubject.asObservable(),
      hideSendMessage$: hideSendMessageSubject.asObservable(),
      admissionState$: new BehaviorSubject({ phase: 'idle', position: 0, estimatedWaitMs: 0 }).asObservable(),
      idleState$: new BehaviorSubject({ phase: 'active', warningCountdownSeconds: 0 }).asObservable(),
      bootFailed$: bootFailedSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        { provide: AppFacade, useValue: appFacadeSpy },
        { provide: WebSocketHandlerService, useValue: jasmine.createSpyObj('WebSocketHandlerService', ['setSessionId']) }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it(`should have the 'omni-angular' title`, () => {
    expect(component.title).toEqual('omni-angular');
  });

  it('should initialize with default values', () => {
    expect(component.messages).toEqual([]);
    expect(component.isLoading).toBeFalse();
    expect(component.topicId).toBe('');
    expect(component.hideHeader).toBeFalse();
    expect(component.hideSendMessage).toBeFalse();
  });

  describe('AppFacade Integration', () => {
    it('should call appFacade.initialize on ngOnInit', () => {
      // Act
      component.ngOnInit();

      // Assert
      expect(appFacadeSpy.initialize).toHaveBeenCalled();
    });

    it('should call appFacade.destroy on ngOnDestroy', () => {
      // Act
      component.ngOnDestroy();

      // Assert
      expect(appFacadeSpy.destroy).toHaveBeenCalled();
    });

    it('should delegate onSidebarClick to appFacade', () => {
      // Arrange
      const mockEvent = new Event('click');

      // Act
      component.onSidebarClick(mockEvent);

      // Assert
      expect(appFacadeSpy.onSidebarClick).toHaveBeenCalledWith(mockEvent);
    });

    it('should update messages when appFacade.messages$ emits', () => {
      // Arrange
      const mockMessages = [{ id: 'msg-1' }] as any[];
      component.ngOnInit();

      // Act
      messagesSubject.next(mockMessages);

      // Assert
      expect(component.messages).toEqual(mockMessages);
    });

    it('should update isLoading when appFacade.isLoading$ emits', () => {
      // Arrange
      component.ngOnInit();

      // Act
      isLoadingSubject.next(true);

      // Assert
      expect(component.isLoading).toBeTrue();
    });

    it('should update topicId when appFacade.sessionId$ emits', () => {
      // Arrange
      component.ngOnInit();

      // Act
      sessionIdSubject.next('test-session-id');

      // Assert
      expect(component.topicId).toBe('test-session-id');
    });

    it('should update hideHeader when appFacade.hideHeader$ emits', () => {
      // Arrange
      component.ngOnInit();

      // Act
      hideHeaderSubject.next(true);

      // Assert
      expect(component.hideHeader).toBeTrue();
    });

    it('should update hideSendMessage when appFacade.hideSendMessage$ emits', () => {
      // Arrange
      component.ngOnInit();

      // Act
      hideSendMessageSubject.next(true);

      // Assert
      expect(component.hideSendMessage).toBeTrue();
    });

    it('should set isBootFailed when appFacade.bootFailed$ emits', () => {
      component.ngOnInit();

      bootFailedSubject.next(true);

      expect(component.isBootFailed).toBeTrue();
    });

    // The failure notice must not sit on top of a live-looking chat pane: the
    // empty transcript keeps its loading overlay animating, which contradicts it.
    it('should show the chat UI on a healthy boot', () => {
      component.ngOnInit();

      expect(component.showChatUI).toBeTrue();
    });

    it('should hide the chat UI once the boot has failed', () => {
      component.ngOnInit();

      bootFailedSubject.next(true);

      expect(component.showChatUI).toBeFalse();
    });

    it('should delegate Try Again to the facade', () => {
      component.onRetryBoot();

      expect(appFacadeSpy.retryBoot).toHaveBeenCalled();
    });

  });

  /**
   * Rendered-DOM guards for the boot-failure state.
   *
   * <p>The tests above assert component flags, which a template change can
   * silently invalidate: deleting the *ngIf, the <app-boot-failed> element or the
   * showChatUI binding would leave every flag assertion green while the user sees
   * either no notice at all, or the notice on top of a chat pane whose loading
   * overlay keeps animating. These assert what actually reaches the DOM.
   */
  describe('Boot-failure rendering', () => {
    const query = (selector: string) => fixture.nativeElement.querySelector(selector);

    it('healthy boot: renders the chat pane and no failure notice', () => {
      fixture.detectChanges();

      expect(query('app-boot-failed')).toBeNull();
      expect(query('app-timeline-view')).not.toBeNull();
    });

    it('failed boot: renders the failure notice', () => {
      fixture.detectChanges();

      bootFailedSubject.next(true);
      fixture.detectChanges();

      expect(query('app-boot-failed')).not.toBeNull();
    });

    it('failed boot: removes the chat pane so nothing keeps animating behind the notice', () => {
      fixture.detectChanges();

      bootFailedSubject.next(true);
      fixture.detectChanges();

      expect(query('app-timeline-view')).toBeNull();
      expect(query('app-footer')).toBeNull();
    });
  });
});
