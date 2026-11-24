import { TestBed } from '@angular/core/testing';
import { KristaFieldFactoryService } from './krista-field-factory.service';
import { FormField } from '../models/message.model';

describe('KristaFieldFactoryService', () => {
  let service: KristaFieldFactoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KristaFieldFactoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Text Field', () => {
    it('should create a text field with proper validation', () => {
      const fieldData: FormField = {
        name: 'firstName',
        fieldType: 'com.krista.fields.Text',
        value: '',
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField).toBeTruthy();
      expect(kristaField.fieldId).toBe('firstName');
      expect(kristaField.required).toBe(true);
      expect(kristaField.isValid).toBe(false); // Empty required field
      expect(kristaField.errorMessage).toBe('This field is required.');
    });

    it('should validate text field with value', () => {
      const fieldData: FormField = {
        name: 'firstName',
        fieldType: 'com.krista.fields.Text',
        value: 'John',
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(true);
      expect(kristaField.errorMessage).toBeNull();
    });

    it('should validate text length constraints', () => {
      const fieldData: FormField = {
        name: 'username',
        fieldType: 'com.krista.fields.Text',
        value: 'ab',
        required: true,
        attributeValues: {
          minLength: 3,
          maxLength: 20
        }
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(false);
      // TranslateModule.forRoot() returns the key when no translations are loaded
      expect(kristaField.errorMessage).toContain('minLength');
    });
  });

  describe('Email Field', () => {
    it('should validate email format', () => {
      const fieldData: FormField = {
        name: 'email',
        fieldType: 'com.krista.fields.Email',
        value: 'invalid-email',
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(false);
      expect(kristaField.errorMessage).toBe('Please enter a valid email address.');
    });

    it('should accept valid email', () => {
      const fieldData: FormField = {
        name: 'email',
        fieldType: 'com.krista.fields.Email',
        value: 'test@example.com',
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(true);
      expect(kristaField.errorMessage).toBeNull();
    });

    it('should format email on blur', () => {
      const fieldData: FormField = {
        name: 'email',
        fieldType: 'com.krista.fields.Email',
        value: '  TEST@EXAMPLE.COM  ',
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.formatOnBlur();

      expect(kristaField.value).toBe('test@example.com');
    });
  });

  describe('Phone Field', () => {
    it('should validate phone number', () => {
      const fieldData: FormField = {
        name: 'phone',
        fieldType: 'com.krista.fields.Phone',
        value: '+12025551234', // Valid US phone number format (Washington DC area code)
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(true);
    });

    it('should validate phone number in object format', () => {
      const fieldData: FormField = {
        name: 'phone',
        fieldType: 'com.krista.fields.Phone',
        value: { countryCode: 1, nationalNumber: 2025551234 }, // Object format
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const fieldData: FormField = {
        name: 'phone',
        fieldType: 'com.krista.fields.Phone',
        value: '123',
        required: true
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(false);
      expect(kristaField.errorMessage).toBe('Invalid phone number.');
    });
  });

  describe('Number Field', () => {
    it('should validate numeric range', () => {
      const fieldData: FormField = {
        name: 'age',
        fieldType: 'com.krista.fields.Number',
        value: '150',
        required: true,
        attributeValues: {
          minValue: 0,
          maxValue: 120
        }
      };

      const kristaField = service.create(fieldData);
      kristaField.validate(); // Trigger validation

      expect(kristaField.isValid).toBe(false);
      // TranslateModule.forRoot() returns the key when no translations are loaded
      expect(kristaField.errorMessage).toContain('maxValue');
    });
  });

  describe('Percentage Field', () => {
    it('should store numeric value on blur (without % symbol)', () => {
      const fieldData: FormField = {
        name: 'discount',
        fieldType: 'com.krista.fields.Percentage',
        value: '25',
        required: false
      };

      const kristaField = service.create(fieldData);
      kristaField.formatOnBlur();

      // PercentageFormatter stores numeric value without % symbol
      // The % is only added for display in the UI
      expect(kristaField.value).toBe(25);
    });

    it('should filter invalid characters from percentage input', () => {
      const fieldData: FormField = {
        name: 'discount',
        fieldType: 'com.krista.fields.Percentage',
        value: '',
        required: false
      };

      const kristaField = service.create(fieldData);

      // Test filtering of invalid characters - format() removes non-numeric chars and % signs
      kristaField.setValue('abc25xyz');
      expect(kristaField.formattedValue).toBe('25');

      // % signs are removed during formatting
      kristaField.setValue('25.5%');
      expect(kristaField.formattedValue).toBe('25.5');

      kristaField.setValue('25..5');
      expect(kristaField.formattedValue).toBe('25.5'); // Only one decimal point

      kristaField.setValue('25%%');
      expect(kristaField.formattedValue).toBe('25'); // % signs are removed
    });
  });

  describe('Value Management', () => {
    it('should track dirty state', () => {
      const fieldData: FormField = {
        name: 'test',
        fieldType: 'com.krista.fields.Text',
        value: 'initial',
        required: false
      };

      const kristaField = service.create(fieldData);

      expect(kristaField.isDirty).toBe(false);

      kristaField.setValue('changed');

      expect(kristaField.isDirty).toBe(true);
      expect(kristaField.value).toBe('changed');
    });

    it('should track touched state', () => {
      const fieldData: FormField = {
        name: 'test',
        fieldType: 'com.krista.fields.Text',
        value: '',
        required: false
      };

      const kristaField = service.create(fieldData);

      expect(kristaField.isTouched).toBe(false);

      kristaField.markAsTouched();

      expect(kristaField.isTouched).toBe(true);
    });

    it('should reset field state', () => {
      const fieldData: FormField = {
        name: 'test',
        fieldType: 'com.krista.fields.Text',
        value: 'initial',
        required: false
      };

      const kristaField = service.create(fieldData);
      kristaField.setValue('changed');
      kristaField.markAsTouched();

      expect(kristaField.isDirty).toBe(true);
      expect(kristaField.isTouched).toBe(true);

      kristaField.reset();

      expect(kristaField.value).toBe('initial');
      expect(kristaField.isDirty).toBe(false);
      expect(kristaField.isTouched).toBe(false);
    });
  });

  describe('Multiple Fields', () => {
    it('should create multiple fields at once', () => {
      const fields: FormField[] = [
        { name: 'field1', fieldType: 'com.krista.fields.Text', value: 'test1' },
        { name: 'field2', fieldType: 'com.krista.fields.Email', value: 'test@example.com' },
        { name: 'field3', fieldType: 'com.krista.fields.Phone', value: '+1234567890' }
      ];

      const kristaFields = service.createMany(fields);

      expect(kristaFields.length).toBe(3);
      expect(kristaFields[0].fieldId).toBe('field1');
      expect(kristaFields[1].fieldId).toBe('field2');
      expect(kristaFields[2].fieldId).toBe('field3');
    });
  });
});

