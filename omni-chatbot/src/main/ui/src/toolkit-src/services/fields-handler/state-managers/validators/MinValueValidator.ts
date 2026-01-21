import i18next from "i18next";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";
import { FieldTypes } from "../FieldTypes";

export class MinValueValidator extends FieldValidator {
  constructor(
    readonly min: number,
    readonly fieldName: string,
    readonly type?: FieldTypes
  ) {
    super(fieldName);
  }

  validate(value: number): ValidateReturnType {
    const errors: string[] = [];
    if (value !== null && value !== undefined && value < this.min) {
      errors.push(
        i18next.t("krista.validators.minValue", {
          min:
            this.type === FieldTypes.PERCENTAGE_FIELD
              ? this.min * 100
              : this.min,
        })
      );
    }
    return errors.length > 0 ? errors : null;
  }
}
