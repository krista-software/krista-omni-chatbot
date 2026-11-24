import { Injectable } from '@angular/core';
import { MessageType } from '../../../ui-toolkit-src-angular';
import { MessageDto, FormDto } from '../../models/api.model';

/**
 * Strategy interface for determining message type
 * 
 * Follows Strategy Pattern to encapsulate message type determination algorithms.
 * Each strategy handles a specific message type determination logic.
 */
export interface MessageTypeStrategy {
  /**
   * Check if this strategy can handle the given message DTO
   */
  canHandle(dto: MessageDto): boolean;

  /**
   * Get the message type for the given DTO
   */
  getType(): MessageType;

  /**
   * Priority of this strategy (higher = checked first)
   */
  readonly priority: number;
}

/**
 * Strategy for MessageInform type
 */
@Injectable()
export class InformMessageStrategy implements MessageTypeStrategy {
  readonly priority = 100;

  canHandle(dto: MessageDto): boolean {
    return dto.type === 'MessageInform';
  }

  getType(): MessageType {
    return MessageType.Inform;
  }
}

/**
 * Strategy for MessageAsk type
 */
@Injectable()
export class AskMessageStrategy implements MessageTypeStrategy {
  readonly priority = 100;

  canHandle(dto: MessageDto): boolean {
    return dto.type === 'MessageAsk';
  }

  getType(): MessageType {
    return MessageType.Ask;
  }
}

/**
 * Strategy for MessageAnswered type
 */
@Injectable()
export class AnsweredMessageStrategy implements MessageTypeStrategy {
  readonly priority = 100;

  canHandle(dto: MessageDto): boolean {
    return dto.type === 'MessageAnswered';
  }

  getType(): MessageType {
    return MessageType.Answered;
  }
}

/**
 * Strategy for MessageResponseAck type
 */
@Injectable()
export class ResponseAckMessageStrategy implements MessageTypeStrategy {
  readonly priority = 100;

  canHandle(dto: MessageDto): boolean {
    return dto.type === 'MessageResponseAck';
  }

  getType(): MessageType {
    return MessageType.ResponseAck;
  }
}

/**
 * Strategy for form-based message type determination
 * When explicit type is not set, determine based on form properties
 */
@Injectable()
export class FormBasedMessageStrategy implements MessageTypeStrategy {
  readonly priority = 50; // Lower priority than explicit type strategies

  canHandle(dto: MessageDto): boolean {
    const form = dto.form as FormDto | undefined;
    return !dto.type && !!form?.pages?.length && form.pages.length > 0;
  }

  getType(): MessageType {
    // This is a fallback - actual determination needs context
    return MessageType.Ask;
  }

  /**
   * Determine message type based on form properties
   */
  determineFromForm(dto: MessageDto): MessageType {
    const form = dto.form as FormDto | undefined;
    
    if (!form?.pages?.length || form.pages.length === 0) {
      return MessageType.Inform;
    }

    // If form has been submitted (has submit type), it's Answered
    if (dto.submit?.type === 'submit' || dto.submit?.type === 'path') {
      return MessageType.Answered;
    }

    // If form is read-only, it's Inform
    if (form.readOnly === true) {
      return MessageType.Inform;
    }

    // Otherwise, it's an Ask (waiting for user input)
    return MessageType.Ask;
  }
}

/**
 * Default strategy when no other strategy matches
 */
@Injectable()
export class DefaultMessageStrategy implements MessageTypeStrategy {
  readonly priority = 0; // Lowest priority

  canHandle(_dto: MessageDto): boolean {
    return true; // Always matches as fallback
  }

  getType(): MessageType {
    return MessageType.Inform;
  }
}

/**
 * Export all strategy classes for registration
 */
export const MESSAGE_TYPE_STRATEGIES = [
  InformMessageStrategy,
  AskMessageStrategy,
  AnsweredMessageStrategy,
  ResponseAckMessageStrategy,
  FormBasedMessageStrategy,
  DefaultMessageStrategy
];

