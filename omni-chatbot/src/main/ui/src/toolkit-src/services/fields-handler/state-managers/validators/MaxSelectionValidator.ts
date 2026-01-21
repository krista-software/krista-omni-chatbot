import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class MaxSelectionValidator extends FieldValidator {
  constructor(readonly max: number, fieldName: string) {
    super(fieldName);
  }

  validate(value: { length: number }): ValidateReturnType {
    const errors: string[] = [];
    if (value && value.length > this.max) {
      errors.push(
        i18next.t("krista.validators.maxSelection", { count: this.max })
      );
    }
    return errors.length > 0 ? errors : null;
  }
}
