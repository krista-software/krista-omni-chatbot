import { ChatStateService } from './chat.state';

describe('ChatStateService — status mode (KR-14876)', () => {
  let service: ChatStateService;

  beforeEach(() => {
    service = new ChatStateService();
  });

  it('defaults to non-status mode', () => {
    expect(service.currentState.isStatusMode).toBe(false);
    expect(service.currentState.statusMessages).toEqual([]);
    expect(service.currentState.statusImage).toBeNull();
  });

  it('setStatusMode activates and stores messages + first message + image', () => {
    service.setStatusMode(['Loading...', 'Done'], 'icon.png');
    expect(service.currentState.isStatusMode).toBe(true);
    expect(service.currentState.statusMessages).toEqual(['Loading...', 'Done']);
    expect(service.currentState.statusMessage).toBe('Loading...');
    expect(service.currentState.statusImage).toBe('icon.png');
  });

  it('setStatusMode defaults imageUrl to null and statusMessage to empty when no messages', () => {
    service.setStatusMode([]);
    expect(service.currentState.isStatusMode).toBe(true);
    expect(service.currentState.statusMessage).toBe('');
    expect(service.currentState.statusImage).toBeNull();
  });

  it('clearStatusMode resets all status fields', () => {
    service.setStatusMode(['x'], 'icon.png');
    service.clearStatusMode();
    expect(service.currentState.isStatusMode).toBe(false);
    expect(service.currentState.statusMessages).toEqual([]);
    expect(service.currentState.statusMessage).toBe('');
    expect(service.currentState.statusImage).toBeNull();
  });
});
