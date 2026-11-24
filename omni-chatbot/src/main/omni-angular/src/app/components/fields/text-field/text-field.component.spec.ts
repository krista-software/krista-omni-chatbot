import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextFieldComponent } from './text-field.component';
import { FormField } from '../../../models/message.model';
import { TextFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('TextFieldComponent', () => {
  let component: TextFieldComponent;
  let fixture: ComponentFixture<TextFieldComponent>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testField',
      fieldType: 'com.krista.fields.Text',
      value: '',
      label: 'Test Field',
      required: false,
      readOnly: false,
      placeholder: 'Enter text',
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  const createMockConfig = (overrides: Partial<TextFieldConfig> = {}): TextFieldConfig => {
    return {
      displayValue: '',
      inputType: 'text',
      hasError: false,
      errorMessage: '',
      readOnly: false,
      placeholder: 'Enter text',
      rows: 4,
      ...overrides
    };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [TextFieldComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(TextFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customField' });
      component.field = field;
      expect(component.field.name).toBe('customField');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ displayValue: 'Test Value' });
      component.config = config;
      expect(component.config.displayValue).toBe('Test Value');
    });
  });

  describe('getDisplayValue', () => {
    it('should return config displayValue when available', () => {
      component.config = createMockConfig({ displayValue: 'Config Value' });
      expect(component.getDisplayValue()).toBe('Config Value');
    });

    it('should return field value when config displayValue is undefined', () => {
      component.config = createMockConfig({ displayValue: undefined });
      component.field = createMockField({ value: 'Field Value' });
      expect(component.getDisplayValue()).toBe('Field Value');
    });

    it('should return empty string when config displayValue is empty string', () => {
      // Note: Empty string is a valid displayValue, so it returns empty string
      component.config = createMockConfig({ displayValue: '' });
      component.field = createMockField({ value: 'Field Value' });
      expect(component.getDisplayValue()).toBe('');
    });

    it('should return empty string when field value is null and config displayValue is undefined', () => {
      component.config = createMockConfig({ displayValue: undefined });
      component.field = createMockField({ value: null });
      expect(component.getDisplayValue()).toBe('');
    });
  });

  describe('config properties', () => {
    it('should return config inputType', () => {
      component.config = createMockConfig({ inputType: 'email' });
      expect(component.config.inputType).toBe('email');
    });

    it('should return true when config hasError is true', () => {
      component.config = createMockConfig({ hasError: true });
      expect(component.config.hasError).toBeTrue();
    });

    it('should return false when config hasError is false', () => {
      component.config = createMockConfig({ hasError: false });
      expect(component.config.hasError).toBeFalse();
    });

    it('should return config errorMessage', () => {
      component.config = createMockConfig({ errorMessage: 'Field is required' });
      expect(component.config.errorMessage).toBe('Field is required');
    });

    it('should return empty string when no error message', () => {
      component.config = createMockConfig({ errorMessage: '' });
      expect(component.config.errorMessage).toBe('');
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

    it('should return true when field readOnly is true', () => {
      component.config = createMockConfig({ readOnly: false });
      component.field = createMockField({ readOnly: true });
      expect(component.isFieldReadOnly()).toBeTrue();
    });
  });

  describe('getPlaceholder', () => {
    it('should return config placeholder when set', () => {
      component.config = createMockConfig({ placeholder: 'Enter your name' });
      expect(component.getPlaceholder()).toBe('Enter your name');
    });

    it('should return generated placeholder when config placeholder is undefined', () => {
      component.config = createMockConfig({ placeholder: undefined });
      component.field = createMockField({ name: 'userName' });
      // TranslateModule.forRoot() returns the key when no translations are loaded
      expect(component.getPlaceholder()).toBe('placeholder.enter');
    });

    it('should return empty string when readOnly and no placeholder', () => {
      component.config = createMockConfig({ placeholder: undefined, readOnly: true });
      expect(component.getPlaceholder()).toBe('');
    });
  });

  describe('onValueChange', () => {
    it('should emit valueChange event with new value', () => {
      spyOn(component.valueChange, 'emit');
      component.onValueChange('new value');
      expect(component.valueChange.emit).toHaveBeenCalledWith('new value');
    });

    it('should emit valueChange event with empty string', () => {
      spyOn(component.valueChange, 'emit');
      component.onValueChange('');
      expect(component.valueChange.emit).toHaveBeenCalledWith('');
    });
  });

  describe('onBlur', () => {
    it('should emit blur event with value', () => {
      spyOn(component.blur, 'emit');
      component.onBlur('test value');
      expect(component.blur.emit).toHaveBeenCalledWith('test value');
    });
  });

  describe('onFocus', () => {
    it('should emit focus event', () => {
      spyOn(component.focus, 'emit');
      component.onFocus();
      expect(component.focus.emit).toHaveBeenCalled();
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

  describe('getAutoCapitalize', () => {
    it('should return autoCapitalize from attributeValues when set', () => {
      component.field = createMockField({
        attributeValues: { autoCapitalize: 'words' }
      });
      expect(component.getAutoCapitalize()).toBe('words');
    });

    it('should return none as default', () => {
      component.field = createMockField({ attributeValues: {} });
      expect(component.getAutoCapitalize()).toBe('none');
    });
  });

  describe('Field Properties', () => {
    it('should display field name', () => {
      component.field = createMockField({ name: 'testFieldName' });
      expect(component.field.name).toBe('testFieldName');
    });

    it('should display required indicator when field is required', () => {
      component.field = createMockField({ required: true });
      expect(component.field.required).toBeTrue();
    });
  });
});

