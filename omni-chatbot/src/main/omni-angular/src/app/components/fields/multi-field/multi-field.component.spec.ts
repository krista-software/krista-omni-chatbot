import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MultiFieldComponent } from './multi-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('MultiFieldComponent', () => {
  let component: MultiFieldComponent;
  let fixture: ComponentFixture<MultiFieldComponent>;
  let mockChangeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  const createMockSubField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'sub-field-1',
      name: 'subField1',
      fieldType: 'com.krista.fields.Text',
      value: '',
      label: 'Sub Field 1',
      required: false,
      readOnly: false,
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testMulti',
      fieldType: 'com.krista.fields.Multi',
      value: {},
      label: 'Test Multi',
      required: false,
      readOnly: false,
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  const createMockConfig = (overrides: Partial<BasicFieldConfig> = {}): BasicFieldConfig => {
    return {
      hasError: false,
      errorMessage: '',
      readOnly: false,
      ...overrides
    };
  };

  beforeEach(async () => {
    mockChangeDetectorRef = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck', 'detectChanges']);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [MultiFieldComponent],
      providers: [
        { provide: ChangeDetectorRef, useValue: mockChangeDetectorRef }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(MultiFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
    component.subFields = [
      createMockSubField({ name: 'firstName', displayName: 'First Name' }),
      createMockSubField({ name: 'lastName', displayName: 'Last Name' })
    ];
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onSubFieldChange', () => {
    it('should emit subFieldValueChange event', () => {
      spyOn(component.subFieldValueChange, 'emit');

      component.onSubFieldChange('firstName', 'Jane');

      expect(component.subFieldValueChange.emit).toHaveBeenCalledWith({ fieldName: 'firstName', value: 'Jane' });
    });
  });

  describe('onNestedSubFieldChange', () => {
    it('should re-emit nested sub-field value changes', () => {
      spyOn(component.subFieldValueChange, 'emit');

      component.onNestedSubFieldChange({ fieldName: 'address.street', value: '456 Oak' });

      expect(component.subFieldValueChange.emit).toHaveBeenCalledWith({ fieldName: 'address.street', value: '456 Oak' });
    });
  });

  describe('onSubFieldBlur', () => {
    it('should emit subFieldBlur event', () => {
      spyOn(component.subFieldBlur, 'emit');

      component.onSubFieldBlur('firstName', 'John');

      expect(component.subFieldBlur.emit).toHaveBeenCalledWith({ fieldName: 'firstName', value: 'John' });
    });
  });

  describe('onSubFieldFocus', () => {
    it('should emit subFieldFocus event', () => {
      spyOn(component.subFieldFocus, 'emit');

      component.onSubFieldFocus('firstName');

      expect(component.subFieldFocus.emit).toHaveBeenCalledWith({ fieldName: 'firstName' });
    });
  });

  describe('onKeyPress', () => {
    it('should emit keyPress event', () => {
      spyOn(component.keyPress, 'emit');
      const event = new KeyboardEvent('keypress', { key: 'Enter' });

      component.onKeyPress(event);

      expect(component.keyPress.emit).toHaveBeenCalledWith(event);
    });
  });

  describe('getSubFieldConfig', () => {
    it('should return config for sub-field', () => {
      component.config = createMockConfig({ readOnly: false });

      const config = component.getSubFieldConfig(createMockSubField());

      expect(config.readOnly).toBeFalse();
      expect(config.hasError).toBeFalse();
    });

    it('should inherit readOnly from parent config', () => {
      component.config = createMockConfig({ readOnly: true });

      const config = component.getSubFieldConfig(createMockSubField());

      expect(config.readOnly).toBeTrue();
    });
  });

  describe('getSubFieldsForNestedField', () => {
    it('should return sub-fields for nested multi-field', () => {
      // Note: The component checks for 'com.krista.fields.MultiField' not 'com.krista.fields.Multi'
      const nestedField = createMockSubField({
        fieldType: 'com.krista.fields.MultiField',
        attributeValues: {
          fields: [
            { name: 'street', fieldType: 'com.krista.fields.Text' },
            { name: 'city', fieldType: 'com.krista.fields.Text' }
          ]
        }
      });

      const subFields = component.getSubFieldsForNestedField(nestedField);

      expect(subFields.length).toBe(2);
    });

    it('should return empty array for non-multi field', () => {
      const textField = createMockSubField({ fieldType: 'com.krista.fields.Text' });

      expect(component.getSubFieldsForNestedField(textField)).toEqual([]);
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

    it('should return false when config readOnly is false', () => {
      component.config = createMockConfig({ readOnly: false });
      expect(component.isFieldReadOnly()).toBeFalse();
    });
  });

  describe('trackByFieldName', () => {
    it('should return field name for tracking', () => {
      const subField = createMockSubField({ name: 'testField' });
      expect(component.trackByFieldName(0, subField)).toBe('testField');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customMulti' });
      component.field = field;
      expect(component.field.name).toBe('customMulti');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Multi field error' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
    });

    it('should accept subFields input', () => {
      const subFields = [createMockSubField({ name: 'test1' }), createMockSubField({ name: 'test2' })];
      component.subFields = subFields;
      expect(component.subFields.length).toBe(2);
    });
  });
});

