import { TestBed } from '@angular/core/testing';
import { MessageTypeService } from './message-type.service';
import { MessageType } from '../../../ui-toolkit-src-angular';
import { MessageDto } from '../../models/api.model';

describe('MessageTypeService', () => {
  let service: MessageTypeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageTypeService]
    });
    service = TestBed.inject(MessageTypeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('determineMessageType', () => {
    describe('explicit type strategies', () => {
      it('should return Inform for MessageInform type', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          type: 'MessageInform',
          inboxId: 'inbox-1'
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Inform);
      });

      it('should return Ask for MessageAsk type', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          type: 'MessageAsk',
          inboxId: 'inbox-1'
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Ask);
      });

      it('should return Answered for MessageAnswered type', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          type: 'MessageAnswered',
          inboxId: 'inbox-1'
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Answered);
      });

      it('should return ResponseAck for MessageResponseAck type', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          type: 'MessageResponseAck',
          inboxId: 'inbox-1'
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.ResponseAck);
      });
    });

    describe('form-based strategies', () => {
      it('should return Ask for form with pages and no submit', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          inboxId: 'inbox-1',
          form: {
            pages: [{ fields: [] }]
          }
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Ask);
      });

      it('should return Answered for form with submit type', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          inboxId: 'inbox-1',
          form: {
            pages: [{ fields: [] }]
          },
          submit: { type: 'submit' }
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Answered);
      });

      it('should return Answered for form with path submit type', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          inboxId: 'inbox-1',
          form: {
            pages: [{ fields: [] }]
          },
          submit: { type: 'path' }
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Answered);
      });

      it('should return Inform for read-only form', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          inboxId: 'inbox-1',
          form: {
            pages: [{ fields: [] }],
            readOnly: true
          }
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Inform);
      });
    });

    describe('default strategy', () => {
      it('should return Inform for message without type or form', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          inboxId: 'inbox-1'
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Inform);
      });

      it('should return Inform for message with empty form pages', () => {
        const dto: MessageDto = {
          id: 'msg-1',
          inboxId: 'inbox-1',
          form: {
            pages: []
          }
        };
        expect(service.determineMessageType(dto)).toBe(MessageType.Inform);
      });
    });
  });

  describe('helper methods', () => {
    it('isAskMessage should return true for Ask type', () => {
      const dto: MessageDto = {
        id: 'msg-1',
        type: 'MessageAsk',
        inboxId: 'inbox-1'
      };
      expect(service.isAskMessage(dto)).toBeTrue();
    });

    it('isInformMessage should return true for Inform type', () => {
      const dto: MessageDto = {
        id: 'msg-1',
        type: 'MessageInform',
        inboxId: 'inbox-1'
      };
      expect(service.isInformMessage(dto)).toBeTrue();
    });

    it('isAnsweredMessage should return true for Answered type', () => {
      const dto: MessageDto = {
        id: 'msg-1',
        type: 'MessageAnswered',
        inboxId: 'inbox-1'
      };
      expect(service.isAnsweredMessage(dto)).toBeTrue();
    });
  });
});

