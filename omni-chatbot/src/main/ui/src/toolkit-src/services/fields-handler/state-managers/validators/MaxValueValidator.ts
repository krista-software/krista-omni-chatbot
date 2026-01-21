import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";
import { FieldTypes } from "../FieldTypes";

export class MaxValueValidator extends FieldValidator {
  constructor(
    readonly max: number,
    readonly fieldName: string,
    readonly type?: FieldTypes
  ) {
    super(fieldName);
  }

  validate(value: number): ValidateReturnType {
    const errors: string[] = [];
    if (value !== null && value !== undefined && value > this.max) {
      errors.push(
        i18next.t("krista.validators.maxValue", {
          max:
            this.type === FieldTypes.PERCENTAGE_FIELD
              ? this.max * 100
              : this.max,
        })
      );
    }
    return errors.length > 0 ? errors : null;
  }
}
