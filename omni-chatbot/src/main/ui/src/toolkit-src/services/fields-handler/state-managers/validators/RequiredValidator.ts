import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class RequiredValidator extends FieldValidator {
  constructor(readonly required: boolean, fieldName: string) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (
      (value === undefined || value === null || value === "") &&
      this.required
    ) {
      errors.push(i18next.t("krista.validators.required"));
    }
    return errors.length > 0 ? errors : null;
  }
}
