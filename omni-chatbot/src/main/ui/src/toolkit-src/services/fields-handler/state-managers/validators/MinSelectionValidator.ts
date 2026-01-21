import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class MinSelectionValidator extends FieldValidator {
  constructor(readonly min: number, fieldName: string) {
    super(fieldName);
  }

  validate(value: { length: number }): ValidateReturnType {
    const errors: string[] = [];
    if (value && value.length < this.min) {
      errors.push(
        i18next.t("krista.validators.minSelection", { count: this.min })
      );
    }
    return errors.length > 0 ? errors : null;
  }
}
