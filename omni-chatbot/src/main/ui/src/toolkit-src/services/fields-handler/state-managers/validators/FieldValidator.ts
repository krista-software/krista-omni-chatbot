export type ValidateReturnType = string[] | null;

export abstract class FieldValidator {
  constructor(readonly fieldName: string) {}
  abstract validate(value: any): ValidateReturnType;
}
