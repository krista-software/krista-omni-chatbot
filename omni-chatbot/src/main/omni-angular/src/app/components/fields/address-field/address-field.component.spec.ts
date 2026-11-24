import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddressFieldComponent, AddressValue } from './address-field.component';
import { FormField } from '../../../models/message.model';
import { AddressFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('AddressFieldComponent', () => {
  let component: AddressFieldComponent;
  let fixture: ComponentFixture<AddressFieldComponent>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testAddress',
      fieldType: 'com.krista.fields.Address',
      value: null,
      label: 'Test Address',
      required: false,
      readOnly: false,
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  const createMockConfig = (overrides: Partial<AddressFieldConfig> = {}): AddressFieldConfig => {
    return {
      streetDisplayValue: '',
      street2DisplayValue: '',
      cityDisplayValue: '',
      stateDisplayValue: '',
      countryDisplayValue: '',
      postalCodeDisplayValue: '',
      hasError: false,
      errorMessage: '',
      readOnly: false,
      ...overrides
    };
  };

  const createMockAddressValue = (overrides: Partial<AddressValue> = {}): AddressValue => ({
    street: '123 Main St',
    street2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    postalCode: '10001',
    ...overrides
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [AddressFieldComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AddressFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
    component.addressValue = {};
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onSubFieldChange', () => {
    it('should emit updated address with changed sub-field', () => {
      spyOn(component.valueChange, 'emit');
      component.addressValue = createMockAddressValue();

      component.onSubFieldChange('city', 'Los Angeles');

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedValue.city).toBe('Los Angeles');
      expect(emittedValue.street).toBe('123 Main St');
    });

    it('should create new address object when addressValue is empty', () => {
      spyOn(component.valueChange, 'emit');
      component.addressValue = {};

      component.onSubFieldChange('street', '456 Oak Ave');

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedValue.street).toBe('456 Oak Ave');
    });
  });

  describe('onSubFieldBlur', () => {
    it('should emit subFieldBlur event with field name and value', () => {
      spyOn(component.subFieldBlur, 'emit');

      component.onSubFieldBlur('street', '123 Main St');

      expect(component.subFieldBlur.emit).toHaveBeenCalledWith({ fieldName: 'street', value: '123 Main St' });
    });
  });

  describe('onSubFieldFocus', () => {
    it('should emit subFieldFocus event with field name', () => {
      spyOn(component.subFieldFocus, 'emit');

      component.onSubFieldFocus('city');

      expect(component.subFieldFocus.emit).toHaveBeenCalledWith({ fieldName: 'city' });
    });
  });

  describe('getSubFieldDefinition', () => {
    it('should return FormField for sub-field', () => {
      component.addressValue = createMockAddressValue();

      const streetDef = component.getSubFieldDefinition('street');

      expect(streetDef.name).toBe('Street Address');
      expect(streetDef.value).toBe('123 Main St');
      expect(streetDef.fieldType).toBe('com.krista.fields.Street');
    });

    it('should inherit readOnly from parent', () => {
      component.field = createMockField({ readOnly: true });

      const streetDef = component.getSubFieldDefinition('street');

      expect(streetDef.readOnly).toBeTrue();
    });

    it('should mark required sub-fields when parent is required', () => {
      component.field = createMockField({ required: true });

      const streetDef = component.getSubFieldDefinition('street');
      const street2Def = component.getSubFieldDefinition('street2');

      expect(streetDef.required).toBeTrue();
      expect(street2Def.required).toBeFalse(); // street2 is optional
    });
  });

  describe('getSubFieldConfig', () => {
    it('should return config for sub-field', () => {
      component.config = createMockConfig({ readOnly: false });

      const config = component.getSubFieldConfig('street');

      expect(config.readOnly).toBeFalse();
      expect(config.hasError).toBeFalse();
    });

    it('should inherit readOnly from parent config', () => {
      component.config = createMockConfig({ readOnly: true });

      const config = component.getSubFieldConfig('street');

      expect(config.readOnly).toBeTrue();
    });
  });

  describe('getSubFieldPlaceholder', () => {
    it('should return placeholder for sub-field', () => {
      component.config = createMockConfig({ readOnly: false });

      expect(component.getSubFieldPlaceholder('street')).toBe('Enter street address');
      expect(component.getSubFieldPlaceholder('city')).toBe('Enter city');
    });

    it('should return empty string when readonly', () => {
      component.config = createMockConfig({ readOnly: true });

      expect(component.getSubFieldPlaceholder('street')).toBe('');
    });
  });

  describe('isFieldRequired', () => {
    it('should return true when field is required', () => {
      component.field = createMockField({ required: true });
      expect(component.isFieldRequired()).toBeTrue();
    });

    it('should return false when field is not required', () => {
      component.field = createMockField({ required: false });
      expect(component.isFieldRequired()).toBeFalse();
    });
  });

  describe('isFieldReadOnly', () => {
    it('should return true when config readOnly is true', () => {
      component.config = createMockConfig({ readOnly: true });
      expect(component.isFieldReadOnly()).toBeTrue();
    });

    it('should return true when field readOnly is true', () => {
      component.field = createMockField({ readOnly: true });
      expect(component.isFieldReadOnly()).toBeTrue();
    });

    it('should return false when both are false', () => {
      component.config = createMockConfig({ readOnly: false });
      component.field = createMockField({ readOnly: false });
      expect(component.isFieldReadOnly()).toBeFalse();
    });
  });

  describe('getFormattedReadOnlyValue', () => {
    it('should return formatted address string', () => {
      component.addressValue = createMockAddressValue();
      component.config = createMockConfig({
        streetDisplayValue: '123 Main St',
        cityDisplayValue: 'New York',
        stateDisplayValue: 'NY'
      });

      const result = component.getFormattedReadOnlyValue();

      expect(result).toContain('123 Main St');
      expect(result).toContain('New York');
      expect(result).toContain('NY');
    });

    it('should return default message when no address', () => {
      component.addressValue = {};
      component.config = createMockConfig();

      expect(component.getFormattedReadOnlyValue()).toBe('No address entered');
    });

    it('should handle partial address', () => {
      component.addressValue = { city: 'Boston', state: 'MA' };
      component.config = createMockConfig({
        cityDisplayValue: 'Boston',
        stateDisplayValue: 'MA'
      });

      const result = component.getFormattedReadOnlyValue();

      expect(result).toContain('Boston');
      expect(result).toContain('MA');
    });
  });

  describe('getSubFieldDisplayValue', () => {
    it('should return display value from config', () => {
      component.config = createMockConfig({ streetDisplayValue: '123 Main St' });
      expect(component.getSubFieldDisplayValue('street')).toBe('123 Main St');
    });

    it('should fallback to addressValue when no display value', () => {
      component.addressValue = { city: 'Boston' };
      component.config = createMockConfig();
      expect(component.getSubFieldDisplayValue('city')).toBe('Boston');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customAddress' });
      component.field = field;
      expect(component.field.name).toBe('customAddress');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Address required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
    });
  });
});

