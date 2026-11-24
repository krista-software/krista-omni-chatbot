/**
 * Strategies barrel export
 * 
 * Strategy Pattern implementations for various algorithms.
 * Strategies encapsulate interchangeable algorithms that can be selected at runtime.
 */

export type { MessageTypeStrategy } from './message-type.strategy';
export {
  InformMessageStrategy,
  AskMessageStrategy,
  AnsweredMessageStrategy,
  ResponseAckMessageStrategy,
  FormBasedMessageStrategy,
  DefaultMessageStrategy,
  MESSAGE_TYPE_STRATEGIES
} from './message-type.strategy';

export { MessageTypeService } from './message-type.service';

