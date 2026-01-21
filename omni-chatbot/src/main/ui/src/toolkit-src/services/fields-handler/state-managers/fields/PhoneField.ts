import { parsePhoneNumberFromString } from "libphonenumber-js";
import { PhoneNumberFieldAttributes } from "../field-attributes/PhoneNumberFieldAttributes";
import { PhoneValue } from "../field-values/PhoneValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { isDefined } from "../../../../common/utils";
import { PhoneNumber } from "../classes/PhoneNumber";
import { PhoneNumberJson } from "../types";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class PhoneField extends KristaTypeField<
  PhoneNumberFieldAttributes,
  PhoneValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.PHONE_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected formatValue(): any {
    return PhoneField.formatFieldValue(this.value, this.attributes);
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): PhoneNumberFieldAttributes {
    return new PhoneNumberFieldAttributes(_attributes);
  }

  /**
   * This method runs the loops for phone number format.
   * Suppose country format is "(###) ###-####" and phone number is ##########
   * it will return (###) ###-####
   * @param format Country phone number format
   * @param number Actual phone number
   */
  static formatPhoneField(format: string, number: number) {
    const stringPhoneNumber = "" + number;
    let formattedPhoneNumber = "";
    for (
      let formatIterator = 0, phoneNumberIterator = 0;
      formatIterator < format.length &&
      phoneNumberIterator < stringPhoneNumber.length;
      formatIterator++
    ) {
      formattedPhoneNumber +=
        format.charAt(formatIterator) === "#"
          ? stringPhoneNumber.charAt(phoneNumberIterator++)
          : format.charAt(formatIterator);
    }
    return formattedPhoneNumber;
  }

  protected createKristaValue(rawValue: PhoneNumberJson): PhoneValue {
    if (!rawValue) {
      return new PhoneValue(undefined);
    }
    const phoneNumber = PhoneNumber.fromJSON(rawValue);
    return new PhoneValue(phoneNumber?.toJSON());
  }

  public static formatFieldValue(
    fieldValue: PhoneValue,
    attributes: PhoneNumberFieldAttributes
  ): string {
    const value = fieldValue.getValue();
    if (!isDefined(value) || !fieldValue.phoneNumber) {
      return "";
    }
    if (fieldValue.phoneNumber.countryCode) {
      try {
        const parsePhoneNum = parsePhoneNumberFromString(fieldValue.toString());
        return parsePhoneNum?.formatInternational() || "";
      } catch (error) {
        return "";
      }
    } else {
      if (attributes.get("formatPattern")) {
        return PhoneField.formatPhoneField(
          attributes.get("formatPattern"),
          fieldValue.phoneNumber.nationalNumber
        );
      } else {
        return `${fieldValue.phoneNumber.nationalNumber}`;
      }
    }
  }
}
