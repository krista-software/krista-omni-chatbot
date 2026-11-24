/**
 * Field Types Constants
 * Single source of truth for all Krista field type identifiers
 * 
 * This file consolidates field type constants that were previously duplicated in:
 * - models/message.model.ts (FieldTypes)
 * - services/krista-field-factory.service.ts (FIELD_TYPES)
 */

/**
 * All Krista field type identifiers
 * Use these constants instead of hardcoded strings throughout the application
 */
export const FIELD_TYPES = {
  // Text-based fields
  TEXT: 'com.krista.fields.Text',
  PARAGRAPH: 'com.krista.fields.Paragraph',
  EMAIL: 'com.krista.fields.Email',
  PHONE: 'com.krista.fields.Phone',
  PROPER_NOUN: 'com.krista.fields.ProperNoun',
  PERSON: 'com.krista.fields.Person',
  IDENTIFIER: 'com.krista.fields.Identifier',
  RICH_TEXT: 'com.krista.fields.RichText',
  LABEL: 'com.krista.fields.Label',

  // Numeric fields
  NUMBER: 'com.krista.fields.Number',
  CURRENCY: 'com.krista.fields.Currency',
  UNIT: 'com.krista.fields.Unit',
  PERCENTAGE: 'com.krista.fields.Percentage',
  DOUBLE: 'com.krista.fields.Double',
  CALCULATION: 'com.krista.fields.Calculation',

  // Date/Time fields
  DATE: 'com.krista.fields.Date',
  TIME: 'com.krista.fields.Time',
  DATE_RANGE: 'com.krista.fields.DateRange',
  DATE_TIME_RANGE: 'com.krista.fields.DateTimeRange',

  // Address fields
  ADDRESS: 'com.krista.fields.Address',
  STREET: 'com.krista.fields.Street',
  STREET2: 'com.krista.fields.Street2',
  CITY: 'com.krista.fields.City',
  STATE: 'com.krista.fields.State',
  COUNTRY: 'com.krista.fields.Country',
  POSTAL_CODE: 'com.krista.fields.PostalCode',

  // Selection fields
  PICK_ONE: 'com.krista.fields.PickOne',
  PICK_MANY: 'com.krista.fields.PickMany',
  CHECKBOXES: 'com.krista.fields.Checkboxes',

  // Boolean/Toggle fields
  SWITCH: 'com.krista.fields.Switch',
  BOOLEAN: 'com.krista.fields.Boolean',

  // Rating field
  RATING: 'com.krista.fields.Rating',

  // File/Media fields
  FILE: 'com.krista.fields.File',
  CAMERA: 'com.krista.fields.Camera',

  // Location field
  LOCATION: 'com.krista.fields.Location',

  // Entity/Reference fields
  ENTITY_SELECTION: 'com.krista.fields.Entity',
  ENTITY_REFERENCE: 'com.krista.fields.EntityReference',

  // Container/Composite fields
  MULTI_FIELD: 'com.krista.fields.MultiField',
  COMPOSITE: 'com.krista.fields.Composite',
  LIST: 'com.krista.fields.List',
  TABLE: 'com.krista.fields.Table',

  // Special fields
  STREAM: 'com.krista.fields.Stream',
  UNKNOWN: 'com.krista.fields.Unknown'
} as const;

/**
 * Type representing any valid field type value
 */
export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];

/**
 * Type representing field type keys
 */
export type FieldTypeKey = keyof typeof FIELD_TYPES;

/**
 * Field types whose renderers expose a focusable text input. Used to decide
 * whether the first field of a freshly rendered form should be auto-focused.
 * Mirrors the 2.0.17 React app's FOCUSABLE_FIELDS list (note: Phone is
 * intentionally excluded).
 */
export const FOCUSABLE_FIELD_TYPES: readonly FieldType[] = [
  FIELD_TYPES.PARAGRAPH,
  FIELD_TYPES.EMAIL,
  FIELD_TYPES.STREET,
  FIELD_TYPES.STREET2,
  FIELD_TYPES.CITY,
  FIELD_TYPES.STATE,
  FIELD_TYPES.POSTAL_CODE,
  FIELD_TYPES.COUNTRY,
  FIELD_TYPES.TEXT,
  FIELD_TYPES.PERSON,
  FIELD_TYPES.PROPER_NOUN,
  FIELD_TYPES.IDENTIFIER,
  FIELD_TYPES.RICH_TEXT,
  FIELD_TYPES.NUMBER,
  FIELD_TYPES.PERCENTAGE,
  FIELD_TYPES.UNIT,
  FIELD_TYPES.CURRENCY
];

/**
 * Legacy alias for backward compatibility
 * @deprecated Use FIELD_TYPES instead
 */
export const FieldTypes = {
  DATE_FIELD: FIELD_TYPES.DATE,
  TIME_FIELD: FIELD_TYPES.TIME,
  DATE_RANGE_FIELD: FIELD_TYPES.DATE_RANGE,
  DATE_TIME_RANGE_FIELD: FIELD_TYPES.DATE_TIME_RANGE,
  TEXT_FIELD: FIELD_TYPES.TEXT,
  LABEL: FIELD_TYPES.LABEL,
  STREET_FIELD: FIELD_TYPES.STREET,
  STREET2_FIELD: FIELD_TYPES.STREET2,
  CITY_FIELD: FIELD_TYPES.CITY,
  STATE_FIELD: FIELD_TYPES.STATE,
  COUNTRY_FIELD: FIELD_TYPES.COUNTRY,
  POSTAL_CODE_FIELD: FIELD_TYPES.POSTAL_CODE,
  NUMBER_FIELD: FIELD_TYPES.NUMBER,
  CURRENCY_FIELD: FIELD_TYPES.CURRENCY,
  UNIT_FIELD: FIELD_TYPES.UNIT,
  PERCENTAGE_FIELD: FIELD_TYPES.PERCENTAGE,
  PICK_ONE_FIELD: FIELD_TYPES.PICK_ONE,
  CHECKBOXES_FIELD: FIELD_TYPES.CHECKBOXES,
  PHONE_FIELD: FIELD_TYPES.PHONE,
  PARAGRAPH_FIELD: FIELD_TYPES.PARAGRAPH,
  PROPER_NOUN_FIELD: FIELD_TYPES.PROPER_NOUN,
  PERSON_FIELD: FIELD_TYPES.PERSON,
  IDENTIFIER_FIELD: FIELD_TYPES.IDENTIFIER,
  SWITCH_FIELD: FIELD_TYPES.SWITCH,
  RATING_FIELD: FIELD_TYPES.RATING,
  EMAIL_FIELD: FIELD_TYPES.EMAIL,
  FILE_FIELD: FIELD_TYPES.FILE,
  CAMERA_FIELD: FIELD_TYPES.CAMERA,
  RICH_TEXT_FIELD: FIELD_TYPES.RICH_TEXT,
  LOCATION_FIELD: FIELD_TYPES.LOCATION,
  CALCULATION_FIELD: FIELD_TYPES.CALCULATION,
  ENTITY_SELECTION: FIELD_TYPES.ENTITY_SELECTION,
  MULTI_FIELD: FIELD_TYPES.MULTI_FIELD,
  COMPOSITE_FIELD: FIELD_TYPES.COMPOSITE,
  ENTITY_FIELD: FIELD_TYPES.ENTITY_REFERENCE,
  LIST_FIELD: FIELD_TYPES.LIST,
  TABLE_FIELD: FIELD_TYPES.TABLE,
  ADDRESS_FIELD: FIELD_TYPES.ADDRESS,
  UNKNOWN_FIELD: FIELD_TYPES.UNKNOWN,
  BOOLEAN_FIELD: FIELD_TYPES.BOOLEAN,
  DOUBLE_FIELD: FIELD_TYPES.DOUBLE,
  STREAM_FIELD: FIELD_TYPES.STREAM
} as const;

