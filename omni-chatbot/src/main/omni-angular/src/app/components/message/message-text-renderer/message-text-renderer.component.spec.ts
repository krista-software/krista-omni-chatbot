import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MessageTextRendererComponent } from './message-text-renderer.component';
import { StorageService } from '../../../services/storage.service';
import { ChatFacade } from '../../../core/facades';
import { SessionService } from '../../../services/session.service';
import { UserService } from '../../../services/user.service';
import { ConfigService } from '../../../services/config.service';

/**
 * These tests focus on onContentClick's link handling — the copy-link fallback
 * that graceful-degrades when a message link's new tab is blocked by a
 * sandboxed host embed (missing 'allow-popups'). Covers both link shapes:
 *   - <krista-link> source citations (real <a target="_blank"> lives in the
 *     element's shadow DOM; event retargeting makes the click target the host)
 *   - plain <a href> markdown links in the light DOM
 */
describe('MessageTextRendererComponent — link handling', () => {
  let component: MessageTextRendererComponent;
  let fixture: ComponentFixture<MessageTextRendererComponent>;
  let chatFacadeSpy: jasmine.SpyObj<ChatFacade>;
  let sessionServiceSpy: jasmine.SpyObj<SessionService>;
  let userServiceSpy: jasmine.SpyObj<UserService>;

  let originalClipboard: PropertyDescriptor | undefined;

  const makeEvent = (target: any): Event =>
    ({
      target,
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation')
    } as unknown as Event);

  const kristaLink = (href: string | null): HTMLElement => {
    const el = document.createElement('krista-link');
    if (href !== null) {
      el.setAttribute('href', href);
    }
    return el;
  };

  const anchor = (href: string): HTMLAnchorElement => {
    const a = document.createElement('a');
    a.setAttribute('href', href);
    return a;
  };

  const setClipboard = (value: any) => {
    Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
  };

  beforeEach(async () => {
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

    const chatFacade = jasmine.createSpyObj('ChatFacade', ['sendMessage']);
    const sessionSpy = jasmine.createSpyObj('SessionService', ['getCurrentSessionId']);
    const userSpy = jasmine.createSpyObj('UserService', ['getCurrentUser']);
    const storageSpy = jasmine.createSpyObj('StorageService', ['getClientSessionId']);
    const configSpy = jasmine.createSpyObj('ConfigService', ['getCurrentConfig']);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [MessageTextRendererComponent],
      providers: [
        { provide: ChatFacade, useValue: chatFacade },
        { provide: SessionService, useValue: sessionSpy },
        { provide: UserService, useValue: userSpy },
        { provide: StorageService, useValue: storageSpy },
        { provide: ConfigService, useValue: configSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(MessageTextRendererComponent);
    component = fixture.componentInstance;
    chatFacadeSpy = TestBed.inject(ChatFacade) as jasmine.SpyObj<ChatFacade>;
    sessionServiceSpy = TestBed.inject(SessionService) as jasmine.SpyObj<SessionService>;
    userServiceSpy = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;

    // Neutralise change detection so handler logic can be tested in isolation
    // without rendering the view.
    spyOn((component as any).cdr, 'detectChanges');
    spyOn((component as any).cdr, 'markForCheck');
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      delete (navigator as any).clipboard;
    }
  });

  describe('krista-link (shadow-DOM source citations)', () => {
    it('opens a full https href in a new tab and severs the opener', () => {
      const fakeWin = { opener: {} } as unknown as Window;
      const openSpy = spyOn(window, 'open').and.returnValue(fakeWin);
      const event = makeEvent(kristaLink('https://example.com/doc.pdf'));

      component.onContentClick(event);

      expect(openSpy).toHaveBeenCalledWith('https://example.com/doc.pdf', '_blank');
      expect(fakeWin.opener).toBeNull();
      expect(component.linkFallbackVisible).toBeFalse();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('prepends https:// to a protocol-less href', () => {
      const openSpy = spyOn(window, 'open').and.returnValue({ opener: {} } as any);

      component.onContentClick(makeEvent(kristaLink('qnst.sharepoint.com/sites/x.docx')));

      expect(openSpy).toHaveBeenCalledWith('https://qnst.sharepoint.com/sites/x.docx', '_blank');
    });

    it('shows the copy-link fallback when the new tab is blocked', () => {
      spyOn(window, 'open').and.returnValue(null);
      const event = makeEvent(kristaLink('qnst.sharepoint.com/sites/x.docx'));

      component.onContentClick(event);

      expect(component.linkFallbackVisible).toBeTrue();
      expect(component.linkFallbackUrl).toBe('https://qnst.sharepoint.com/sites/x.docx');
      expect(component.linkFallbackCopied).toBeFalse();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('ignores a krista-link with no href', () => {
      const openSpy = spyOn(window, 'open');
      const event = makeEvent(kristaLink(null));

      component.onContentClick(event);

      expect(openSpy).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(component.linkFallbackVisible).toBeFalse();
    });
  });

  describe('plain <a href> links', () => {
    it('opens an https anchor in a new tab and severs the opener', () => {
      const fakeWin = { opener: {} } as unknown as Window;
      const openSpy = spyOn(window, 'open').and.returnValue(fakeWin);
      const event = makeEvent(anchor('https://foo.com/page'));

      component.onContentClick(event);

      expect(openSpy).toHaveBeenCalledWith('https://foo.com/page', '_blank');
      expect(fakeWin.opener).toBeNull();
      expect(component.linkFallbackVisible).toBeFalse();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('shows the fallback when a plain anchor new tab is blocked', () => {
      spyOn(window, 'open').and.returnValue(null);

      component.onContentClick(makeEvent(anchor('https://foo.com/page')));

      expect(component.linkFallbackVisible).toBeTrue();
      expect(component.linkFallbackUrl).toBe('https://foo.com/page');
    });

    it('does not intercept a non-http anchor (e.g. mailto:)', () => {
      const openSpy = spyOn(window, 'open');
      const event = makeEvent(anchor('mailto:someone@example.com'));

      component.onContentClick(event);

      expect(openSpy).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(component.linkFallbackVisible).toBeFalse();
    });

    it('routes an anchor that wraps an image to the image modal, not the link handler', () => {
      const openSpy = spyOn(window, 'open');
      const a = anchor('https://foo.com/page');
      const img = document.createElement('img');
      img.setAttribute('src', 'https://foo.com/pic.png');
      a.appendChild(img);

      component.onContentClick(makeEvent(a));

      expect(openSpy).not.toHaveBeenCalled();
      expect(component.imageModalVisible).toBeTrue();
      expect(component.imageModalSrc).toContain('pic.png');
    });
  });

  describe('copyFallbackLink', () => {
    beforeEach(() => {
      component.linkFallbackUrl = 'https://copy.me/doc';
      component.linkFallbackCopied = false;
    });

    it('copies via the async Clipboard API and marks copied', fakeAsync(() => {
      const writeSpy = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
      setClipboard({ writeText: writeSpy });

      component.copyFallbackLink();
      flushMicrotasks();

      expect(writeSpy).toHaveBeenCalledWith('https://copy.me/doc');
      expect(component.linkFallbackCopied).toBeTrue();
    }));

    it('falls back to execCommand when the Clipboard API rejects', fakeAsync(() => {
      setClipboard({ writeText: jasmine.createSpy('writeText').and.callFake(() => Promise.reject('denied')) });
      const execSpy = spyOn(document, 'execCommand').and.returnValue(true);

      component.copyFallbackLink();
      flushMicrotasks();

      expect(execSpy).toHaveBeenCalledWith('copy');
      expect(component.linkFallbackCopied).toBeTrue();
    }));

    it('falls back to execCommand when the Clipboard API is unavailable', () => {
      setClipboard(undefined);
      const execSpy = spyOn(document, 'execCommand').and.returnValue(true);

      component.copyFallbackLink();

      expect(execSpy).toHaveBeenCalledWith('copy');
      expect(component.linkFallbackCopied).toBeTrue();
    });

    it('does not mark copied and does not throw when execCommand fails', () => {
      setClipboard(undefined);
      spyOn(document, 'execCommand').and.throwError('copy unavailable');

      expect(() => component.copyFallbackLink()).not.toThrow();
      expect(component.linkFallbackCopied).toBeFalse();
    });
  });

  describe('fallback lifecycle', () => {
    it('dismissLinkFallback hides the fallback', () => {
      component.linkFallbackVisible = true;

      component.dismissLinkFallback();

      expect(component.linkFallbackVisible).toBeFalse();
    });

    it('resets the copied flag when a new link is blocked', () => {
      component.linkFallbackCopied = true;
      spyOn(window, 'open').and.returnValue(null);

      component.onContentClick(makeEvent(anchor('https://foo.com/other')));

      expect(component.linkFallbackVisible).toBeTrue();
      expect(component.linkFallbackCopied).toBeFalse();
    });
  });

  describe('non-link clicks are unaffected', () => {
    it('opens the image modal on a direct image click without touching window.open', () => {
      const openSpy = spyOn(window, 'open');
      const img = document.createElement('img');
      img.setAttribute('src', 'https://foo.com/pic.png');
      img.setAttribute('alt', 'A picture');

      component.onContentClick(makeEvent(img));

      expect(openSpy).not.toHaveBeenCalled();
      expect(component.imageModalVisible).toBeTrue();
      expect(component.imageModalAlt).toBe('A picture');
    });

    it('sends a message on a krista-button option click without touching window.open', () => {
      const openSpy = spyOn(window, 'open');
      sessionServiceSpy.getCurrentSessionId.and.returnValue('sess-1');
      userServiceSpy.getCurrentUser.and.returnValue({ accountId: 'u1' } as any);

      const button = document.createElement('krista-button');
      button.setAttribute('button-type', 'option');
      button.setAttribute('name', 'Yes');

      component.onContentClick(makeEvent(button));

      expect(openSpy).not.toHaveBeenCalled();
      expect(chatFacadeSpy.sendMessage).toHaveBeenCalledWith('Yes');
    });
  });
});
