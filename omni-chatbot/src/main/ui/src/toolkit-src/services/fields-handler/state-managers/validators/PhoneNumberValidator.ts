import { parsePhoneNumber } from "libphonenumber-js";
import i18next from "i18next";
import { PhoneNumber } from "../classes/PhoneNumber";
import { FieldValidator, ValidateReturnType } from "./FieldValidator";

export class PhoneNumberValidator extends FieldValidator {
  constructor(fieldName: string) {
    super(fieldName);
  }

  validate(value: any): ValidateReturnType {
    const errors: string[] = [];
    if (value) {
      const phoneNumberJson = PhoneNumber.fromJSON(value);
      if (phoneNumberJson) {
        try {
          parsePhoneNumber(phoneNumberJson.toString());
        } catch (error) {
          if (phoneNumberJson.countryCode) {
            errors.push(i18next.t("krista.validators.invalidPhoneNumber"));
          }
        }
      }
    }
    return errors.length > 0 ? errors : null;
  }
}
