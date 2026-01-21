import { DateRangeJson } from "../types";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class AllowedRangeValidator extends FieldValidator {
  constructor(
    readonly allowedRange: Omit<DateRangeJson, "type">,
    fieldName: string
  ) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (this.allowedRange && value && value.from && value.to) {
      // TODO
      // 1. check timestamps provided by Studio - are they always UTC+0 timezone
      // 2. when timezone selected
    }
    return errors.length > 0 ? errors : null;
  }
}
