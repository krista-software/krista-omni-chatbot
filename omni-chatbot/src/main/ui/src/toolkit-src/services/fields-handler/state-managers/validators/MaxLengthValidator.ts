import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class MaxLengthValidator extends FieldValidator {
  constructor(readonly max: number, fieldName: string) {
    super(fieldName);
  }

  validate(value: { length: number }): ValidateReturnType {
    const errors: string[] = [];
    if (value && value.length > this.max) {
      errors.push(
        i18next.t("krista.validators.maxLength", { length: this.max })
      );
    }
    return errors.length > 0 ? errors : null;
  }
}
