import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class PatternValidator extends FieldValidator {
  constructor(readonly pattern: string, fieldName: string) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (value) {
      const regexp = new RegExp(this.pattern);
      if (regexp && !regexp.test(value)) {
        errors.push(
          i18next.t("krista.validators.pattern", { pattern: this.pattern })
        );
      }
    }
    return errors.length > 0 ? errors : null;
  }
}
