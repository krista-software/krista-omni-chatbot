import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class DateRangeValidator extends FieldValidator {
  constructor(fieldName: string) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (value && value.from && value.to) {
      if (value.from > value.to) {
        errors.push(i18next.t("krista.validators.startDateLessThanEndDate"));
      }
    }
    return errors.length > 0 ? errors : null;
  }
}
