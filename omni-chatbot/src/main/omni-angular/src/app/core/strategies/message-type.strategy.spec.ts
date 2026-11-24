import { MessageType } from '../../../ui-toolkit-src-angular';
import { MessageDto } from '../../models/api.model';
import {
  InformMessageStrategy,
  AskMessageStrategy,
  AnsweredMessageStrategy,
  ResponseAckMessageStrategy,
  FormBasedMessageStrategy,
  DefaultMessageStrategy
} from './message-type.strategy';

describe('Message Type Strategies', () => {
  describe('InformMessageStrategy', () => {
    let strategy: InformMessageStrategy;

    beforeEach(() => {
      strategy = new InformMessageStrategy();
    });

    it('should have priority 100', () => {
      expect(strategy.priority).toBe(100);
    });

    it('should handle MessageInform type', () => {
      const dto: MessageDto = { id: '1', type: 'MessageInform', inboxId: 'inbox-1' };
      expect(strategy.canHandle(dto)).toBeTrue();
    });

    it('should not handle other types', () => {
      const dto: MessageDto = { id: '1', type: 'MessageAsk', inboxId: 'inbox-1' };
      expect(strategy.canHandle(dto)).toBeFalse();
    });

    it('should return Inform type', () => {
      expect(strategy.getType()).toBe(MessageType.Inform);
    });
  });

  describe('AskMessageStrategy', () => {
    let strategy: AskMessageStrategy;

    beforeEach(() => {
      strategy = new AskMessageStrategy();
    });

    it('should have priority 100', () => {
      expect(strategy.priority).toBe(100);
    });

    it('should handle MessageAsk type', () => {
      const dto: MessageDto = { id: '1', type: 'MessageAsk', inboxId: 'inbox-1' };
      expect(strategy.canHandle(dto)).toBeTrue();
    });

    it('should not handle other types', () => {
      const dto: MessageDto = { id: '1', type: 'MessageInform', inboxId: 'inbox-1' };
      expect(strategy.canHandle(dto)).toBeFalse();
    });

    it('should return Ask type', () => {
      expect(strategy.getType()).toBe(MessageType.Ask);
    });
  });

  describe('AnsweredMessageStrategy', () => {
    let strategy: AnsweredMessageStrategy;

    beforeEach(() => {
      strategy = new AnsweredMessageStrategy();
    });

    it('should have priority 100', () => {
      expect(strategy.priority).toBe(100);
    });

    it('should handle MessageAnswered type', () => {
      const dto: MessageDto = { id: '1', type: 'MessageAnswered', inboxId: 'inbox-1' };
      expect(strategy.canHandle(dto)).toBeTrue();
    });

    it('should return Answered type', () => {
      expect(strategy.getType()).toBe(MessageType.Answered);
    });
  });

  describe('ResponseAckMessageStrategy', () => {
    let strategy: ResponseAckMessageStrategy;

    beforeEach(() => {
      strategy = new ResponseAckMessageStrategy();
    });

    it('should have priority 100', () => {
      expect(strategy.priority).toBe(100);
    });

    it('should handle MessageResponseAck type', () => {
      const dto: MessageDto = { id: '1', type: 'MessageResponseAck', inboxId: 'inbox-1' };
      expect(strategy.canHandle(dto)).toBeTrue();
    });

    it('should return ResponseAck type', () => {
      expect(strategy.getType()).toBe(MessageType.ResponseAck);
    });
  });

  describe('FormBasedMessageStrategy', () => {
    let strategy: FormBasedMessageStrategy;

    beforeEach(() => {
      strategy = new FormBasedMessageStrategy();
    });

    it('should have priority 50', () => {
      expect(strategy.priority).toBe(50);
    });

    it('should handle messages with form pages and no explicit type', () => {
      const dto: MessageDto = {
        id: '1',
        inboxId: 'inbox-1',
        form: { pages: [{ fields: [] }] }
      };
      expect(strategy.canHandle(dto)).toBeTrue();
    });

    it('should not handle messages with explicit type', () => {
      const dto: MessageDto = {
        id: '1',
        type: 'MessageInform',
        inboxId: 'inbox-1',
        form: { pages: [{ fields: [] }] }
      };
      expect(strategy.canHandle(dto)).toBeFalse();
    });

    it('should return Answered for submitted forms', () => {
      const dto: MessageDto = {
        id: '1',
        inboxId: 'inbox-1',
        form: { pages: [{ fields: [] }] },
        submit: { type: 'submit' }
      };
      expect(strategy.determineFromForm(dto)).toBe(MessageType.Answered);
    });

    it('should return Inform for read-only forms', () => {
      const dto: MessageDto = {
        id: '1',
        inboxId: 'inbox-1',
        form: { pages: [{ fields: [] }], readOnly: true }
      };
      expect(strategy.determineFromForm(dto)).toBe(MessageType.Inform);
    });
  });

  describe('DefaultMessageStrategy', () => {
    let strategy: DefaultMessageStrategy;

    beforeEach(() => {
      strategy = new DefaultMessageStrategy();
    });

    it('should have priority 0', () => {
      expect(strategy.priority).toBe(0);
    });

    it('should always handle any message', () => {
      const dto: MessageDto = { id: '1', inboxId: 'inbox-1' };
      expect(strategy.canHandle(dto)).toBeTrue();
    });

    it('should return Inform type', () => {
      expect(strategy.getType()).toBe(MessageType.Inform);
    });
  });
});

