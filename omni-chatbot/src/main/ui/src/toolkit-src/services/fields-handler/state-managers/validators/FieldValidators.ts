import { KSDKFormField } from "./../../../messaging/form/KSDKFormField";
import { FieldTypes } from "../FieldTypes";
import { AllowedRangeValidator } from "./AllowedRangeValidator";
import { DateRangeValidator } from "./DateRangeValidator";
import { EmailValidator } from "./EmailValidator";
import { FieldValidator } from "./FieldValidator";
import { MaxDurationDaysValidator } from "./MaxDurationDaysValidator";
import { MaxDurationHoursValidator } from "./MaxDurationHoursValidator";
import { MaxLengthValidator } from "./MaxLengthValidator";
import { MaxSelectionValidator } from "./MaxSelectionValidator";
import { MaxValueValidator } from "./MaxValueValidator";
import { MinLengthValidator } from "./MinLengthValidator";
import { MinSelectionValidator } from "./MinSelectionValidator";
import { MinValueValidator } from "./MinValueValidator";
import { PatternValidator } from "./PatternValidator";
import { PhoneNumberValidator } from "./PhoneNumberValidator";
import { RequiredValidator } from "./RequiredValidator";
import { RTEMaxLengthValidator } from "./RTEMaxLengthValidator";
import { RTEMinLengthValidator } from "./RTEMinLengthValidator";

export class FieldValidators {
  isValid = true;
  errors: string[] = [];

  constructor(readonly validators: FieldValidator[] = []) {}

  addValidator(validator: FieldValidator) {
    this.validators.push(validator);
  }

  validate(value: any): string[] {
    this.errors = [];
    this.validators.forEach((validator) => {
      const errors = validator.validate(value);
      if (errors) {
        this.errors.push(...errors);
      }
    });
    this.isValid = this.errors.length === 0;
    return this.errors;
  }
}

export function getFieldValidators(
  field: KSDKFormField,
  fieldName: string,
  attributes: Map<string, any>
) {
  const validators: FieldValidator[] = [];
  if (field.required) {
    validators.push(new RequiredValidator(true, fieldName));
  }
  if (field.fieldType === FieldTypes.EMAIL_FIELD) {
    validators.push(
      new EmailValidator(attributes.get("allowedDomains"), fieldName)
    );
  }
  if (field.fieldType === FieldTypes.PHONE_FIELD) {
    validators.push(new PhoneNumberValidator(fieldName));
  }
  if (
    field.fieldType === FieldTypes.DATE_RANGE_FIELD ||
    field.fieldType === FieldTypes.DATE_TIME_RANGE_FIELD
  ) {
    validators.push(new DateRangeValidator(fieldName));
  }
  attributes.forEach((value, key) => {
    switch (key) {
      case "minLength":
        if (field.fieldType === FieldTypes.RICH_TEXT_FIELD && value) {
          validators.push(new RTEMinLengthValidator(value, fieldName));
        } else {
          validators.push(new MinLengthValidator(value, fieldName));
        }
        break;
      case "maxLength":
        if (field.fieldType === FieldTypes.RICH_TEXT_FIELD && value) {
          validators.push(new RTEMaxLengthValidator(value, fieldName));
        } else {
          validators.push(new MaxLengthValidator(value, fieldName));
        }
        break;
      case "minValue":
        validators.push(
          new MinValueValidator(value, fieldName, field.fieldType)
        );
        break;
      case "maxValue":
        validators.push(
          new MaxValueValidator(value, fieldName, field.fieldType)
        );
        break;
      case "minSelection":
        validators.push(new MinSelectionValidator(value, fieldName));
        break;
      case "maxSelection":
        validators.push(new MaxSelectionValidator(value, fieldName));
        break;
      case "pattern":
        validators.push(new PatternValidator(value, fieldName));
        break;
      case "allowedRange":
        validators.push(new AllowedRangeValidator(value, fieldName));
        break;
      case "maxDurationInHours":
        validators.push(new MaxDurationHoursValidator(value, fieldName));
        break;
      case "maxDurationInDays":
        validators.push(new MaxDurationDaysValidator(value, fieldName));
        break;
      default:
    }
  });
  return validators;
}
