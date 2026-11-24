import { Injectable } from '@angular/core';
import { MessageType } from '../../../ui-toolkit-src-angular';
import { MessageDto, FormDto } from '../../models/api.model';
import {
  MessageTypeStrategy,
  InformMessageStrategy,
  AskMessageStrategy,
  AnsweredMessageStrategy,
  ResponseAckMessageStrategy,
  FormBasedMessageStrategy,
  DefaultMessageStrategy
} from './message-type.strategy';

/**
 * Message Type Service
 * 
 * Uses Strategy Pattern to determine message types.
 * Strategies are sorted by priority and the first matching strategy is used.
 * 
 * Benefits:
 * - Open/Closed Principle: Add new strategies without modifying existing code
 * - Single Responsibility: Each strategy handles one type determination
 * - Testability: Each strategy can be tested independently
 */
@Injectable({
  providedIn: 'root'
})
export class MessageTypeService {
  private strategies: MessageTypeStrategy[];
  private formBasedStrategy: FormBasedMessageStrategy;

  constructor() {
    // Initialize strategies
    this.formBasedStrategy = new FormBasedMessageStrategy();
    
    this.strategies = [
      new InformMessageStrategy(),
      new AskMessageStrategy(),
      new AnsweredMessageStrategy(),
      new ResponseAckMessageStrategy(),
      this.formBasedStrategy,
      new DefaultMessageStrategy()
    ];

    // Sort by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Determine the message type for a given DTO
   */
  determineMessageType(dto: MessageDto): MessageType {
    // First, check explicit type strategies
    for (const strategy of this.strategies) {
      if (strategy.canHandle(dto)) {
        // Special handling for form-based strategy
        if (strategy instanceof FormBasedMessageStrategy) {
          return strategy.determineFromForm(dto);
        }
        return strategy.getType();
      }
    }

    // Fallback to Inform
    return MessageType.Inform;
  }

  /**
   * Check if a message is an Ask type (requires user input)
   */
  isAskMessage(dto: MessageDto): boolean {
    return this.determineMessageType(dto) === MessageType.Ask;
  }

  /**
   * Check if a message is an Inform type (display only)
   */
  isInformMessage(dto: MessageDto): boolean {
    return this.determineMessageType(dto) === MessageType.Inform;
  }

  /**
   * Check if a message is an Answered type (user has responded)
   */
  isAnsweredMessage(dto: MessageDto): boolean {
    return this.determineMessageType(dto) === MessageType.Answered;
  }

  /**
   * Check if a message has a form that requires user input
   */
  hasActiveForm(dto: MessageDto): boolean {
    const form = dto.form as FormDto | undefined;
    if (!form?.pages?.length || form.pages.length === 0) {
      return false;
    }
    return !form.readOnly && !dto.submit;
  }

  /**
   * Check if a message has a read-only form
   */
  hasReadOnlyForm(dto: MessageDto): boolean {
    const form = dto.form as FormDto | undefined;
    if (!form?.pages?.length || form.pages.length === 0) {
      return false;
    }
    return form.readOnly === true;
  }

  /**
   * Check if a message has been submitted
   */
  isSubmitted(dto: MessageDto): boolean {
    return dto.submit?.type === 'submit' || dto.submit?.type === 'path';
  }
}

