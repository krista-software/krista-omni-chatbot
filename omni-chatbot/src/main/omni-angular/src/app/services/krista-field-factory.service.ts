import { Injectable } from '@angular/core';
import { FormField } from '../models/message.model';
import { KristaField } from '../models/krista-field.model';
import { FIELD_TYPES } from '../config/field-types.constant';
import { FieldValidator } from '../models/validators/field-validator.interface';
import { FieldFormatter } from '../models/formatters/field-formatter.interface';
import {
  RequiredValidator,
  EmailValidator,
  PhoneValidator,
  TextLengthValidator,
  NumericRangeValidator,
  PatternValidator,
  PickManyValidator,
  DateValidator,
  TimeValidator,
  DateRangeValidator,
  DateTimeRangeValidator,
  RatingValidator,
  FileValidator
} from '../models/validators/base-validators';
import {
  TextFormatter,
  EmailFormatter,
  PhoneFormatter,
  NumberFormatter,
  CurrencyFormatter,
  PercentageFormatter,
  ProperNounFormatter,
  IdentifierFormatter,
  AddressFormatter,
  PostalCodeFormatter,
  DateRangeFormatter,
  DateTimeRangeFormatter,
  LocationFormatter,
  EntitySelectionFormatter
} from '../models/formatters/base-formatters';

/**
 * Factory service for creating KristaField instances
 * 
 * This service:
 * - Creates KristaField instances based on field type
 * - Assigns appropriate validators for each field type
 * - Assigns appropriate formatters for each field type
 * - Provides centralized field creation logic
 */
@Injectable({
  providedIn: 'root'
})
export class KristaFieldFactoryService {
  constructor() {}

  /**
   * Create a KristaField instance for the given FormField
   * 
   * @param fieldData - The FormField data
   * @returns KristaField instance with appropriate validators and formatter
   */
  create(fieldData: FormField): KristaField {
    const validators = this.getValidators(fieldData);
    const formatter = this.getFormatter(fieldData);
    return new KristaField(fieldData, validators, formatter);
  }

  /**
   * Create multiple KristaField instances from an array of FormFields
   * 
   * @param fields - Array of FormField data
   * @returns Array of KristaField instances
   */
  createMany(fields: FormField[]): KristaField[] {
    return fields.map(field => this.create(field));
  }

  /**
   * Get validators for a field based on its type and attributes
   * 
   * @param field - The FormField data
   * @returns Array of validators to apply
   */
  private getValidators(field: FormField): FieldValidator[] {
    const validators: FieldValidator[] = [];

    // Always add required validator (it checks if field is required)
    validators.push(new RequiredValidator());

    // Add field-type-specific validators
    switch (field.fieldType) {
      case FIELD_TYPES.EMAIL:
        validators.push(new EmailValidator());
        validators.push(new TextLengthValidator());
        break;

      case FIELD_TYPES.PHONE:
        validators.push(new PhoneValidator());
        break;

      case FIELD_TYPES.TEXT:
      case FIELD_TYPES.PARAGRAPH:
      case FIELD_TYPES.PROPER_NOUN:
      case FIELD_TYPES.PERSON:
      case FIELD_TYPES.IDENTIFIER:
        validators.push(new TextLengthValidator());
        validators.push(new PatternValidator());
        break;

      case FIELD_TYPES.NUMBER:
      case FIELD_TYPES.CURRENCY:
      case FIELD_TYPES.UNIT:
      case FIELD_TYPES.PERCENTAGE:
        validators.push(new NumericRangeValidator());
        break;

      case FIELD_TYPES.PICK_MANY:
      case FIELD_TYPES.CHECKBOXES:
        validators.push(new PickManyValidator());
        break;

      case FIELD_TYPES.DATE:
        validators.push(new DateValidator());
        break;

      case FIELD_TYPES.TIME:
        validators.push(new TimeValidator());
        break;

      case FIELD_TYPES.DATE_RANGE:
        validators.push(new DateRangeValidator());
        break;

      case FIELD_TYPES.DATE_TIME_RANGE:
        validators.push(new DateTimeRangeValidator());
        break;

      case FIELD_TYPES.RATING:
        validators.push(new RatingValidator());
        break;

      case FIELD_TYPES.FILE:
        validators.push(new FileValidator());
        break;

      case FIELD_TYPES.ENTITY_SELECTION:
        // EntitySelection uses basic required validation
        break;

      // Other field types (Location, Switch, etc.)
      // will use basic required validation
      default:
        // Add pattern validator if pattern is specified
        if (field.attributeValues?.['pattern']) {
          validators.push(new PatternValidator());
        }
        break;
    }

    return validators;
  }

  /**
   * Get formatter for a field based on its type
   * 
   * @param field - The FormField data
   * @returns Formatter for this field type
   */
  private getFormatter(field: FormField): FieldFormatter {
    switch (field.fieldType) {
      case FIELD_TYPES.EMAIL:
        return new EmailFormatter();

      case FIELD_TYPES.PHONE:
        return new PhoneFormatter();

      case FIELD_TYPES.NUMBER:
      case FIELD_TYPES.UNIT:
        return new NumberFormatter();

      case FIELD_TYPES.CURRENCY:
        return new CurrencyFormatter();

      case FIELD_TYPES.PERCENTAGE:
        return new PercentageFormatter();

      case FIELD_TYPES.PROPER_NOUN:
      case FIELD_TYPES.PERSON:
        return new ProperNounFormatter();

      case FIELD_TYPES.IDENTIFIER:
        return new IdentifierFormatter();

      case FIELD_TYPES.ADDRESS:
        return new AddressFormatter();

      case FIELD_TYPES.POSTAL_CODE:
        return new PostalCodeFormatter();

      case FIELD_TYPES.DATE_RANGE:
        return new DateRangeFormatter();

      case FIELD_TYPES.DATE_TIME_RANGE:
        return new DateTimeRangeFormatter();

      case FIELD_TYPES.LOCATION:
        return new LocationFormatter();

      case FIELD_TYPES.ENTITY_SELECTION:
        return new EntitySelectionFormatter();

      // Default formatter for all other types
      case FIELD_TYPES.TEXT:
      case FIELD_TYPES.PARAGRAPH:
      case FIELD_TYPES.PICK_ONE:
      case FIELD_TYPES.PICK_MANY:
      case FIELD_TYPES.CHECKBOXES:
      case FIELD_TYPES.DATE:
      case FIELD_TYPES.TIME:
      case FIELD_TYPES.FILE:
      case FIELD_TYPES.SWITCH:
      case FIELD_TYPES.RATING:
      default:
        return new TextFormatter();
    }
  }

  /**
   * Check if a field type is supported by KristaField
   *
   * @param fieldType - The field type to check
   * @returns true if supported, false otherwise
   */
  isSupported(fieldType: string): boolean {
    return Object.values(FIELD_TYPES).includes(fieldType as typeof FIELD_TYPES[keyof typeof FIELD_TYPES]);
  }

  /**
   * Get all supported field types
   *
   * @returns Array of supported field type strings
   */
  getSupportedFieldTypes(): string[] {
    return Object.values(FIELD_TYPES);
  }
}

