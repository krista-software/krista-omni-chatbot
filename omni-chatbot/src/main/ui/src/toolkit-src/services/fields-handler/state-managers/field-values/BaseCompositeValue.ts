import { KristaValue } from "./KristaValue";

export abstract class BaseCompositeValue extends KristaValue {
  abstract isEmpty(): boolean;

  abstract setFieldValue(fieldId: string, kristaValue: KristaValue): void;

  abstract getFieldValue(fieldId: string): KristaValue | undefined;
}
