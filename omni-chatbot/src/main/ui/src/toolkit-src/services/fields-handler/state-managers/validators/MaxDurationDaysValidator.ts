import dayjs from "dayjs";
import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class MaxDurationDaysValidator extends FieldValidator {
  constructor(readonly maxDurationInDays: number, fieldName: string) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (value && value.from && value.to) {
      const toDate = dayjs(value.to);
      const fromDate = dayjs(value.from);
      const differenceInDays = toDate.diff(fromDate, "day", true);

      if (differenceInDays >= this.maxDurationInDays) {
        errors.push(
          i18next.t("krista.validators.maxDateRangeInDays", {
            days: this.maxDurationInDays,
          })
        );
      }
    }
    return errors.length > 0 ? errors : null;
  }
}
