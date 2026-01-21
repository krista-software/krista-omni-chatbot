import dayjs from "dayjs";
import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class MaxDurationHoursValidator extends FieldValidator {
  constructor(readonly maxDurationInHours: number, fieldName: string) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (value && value.from && value.to) {
      const toDate = dayjs(value.to);
      const fromDate = dayjs(value.from);
      const differenceInDays = toDate.diff(fromDate, "hour", true);

      if (differenceInDays > this.maxDurationInHours) {
        errors.push(
          i18next.t("krista.validators.maxDateRangeInHours", {
            hours: this.maxDurationInHours,
          })
        );
      }
    }
    return errors.length > 0 ? errors : null;
  }
}
