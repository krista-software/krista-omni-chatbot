import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberFieldComponent } from './number-field.component';
import { FormField } from '../../../models/message.model';
import { TextFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('NumberFieldComponent', () => {
  let component: NumberFieldComponent;
  let fixture: ComponentFixture<NumberFieldComponent>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testNumber',
      fieldType: 'com.krista.fields.Number',
      value: 0,
      label: 'Test Number',
      required: false,
      readOnly: false,
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
      placeholder: undefined,
      rows: 4,
      ...overrides
    };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [NumberFieldComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(NumberFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customNumber' });
      component.field = field;
      expect(component.field.name).toBe('customNumber');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ displayValue: '123' });
      component.config = config;
      expect(component.config.displayValue).toBe('123');
    });
  });

  describe('getDisplayValue', () => {
    it('should return config displayValue when available', () => {
      component.config = createMockConfig({ displayValue: '456' });
      expect(component.getDisplayValue()).toBe('456');
    });

    it('should return field value as string when config displayValue is undefined', () => {
      component.config = createMockConfig({ displayValue: undefined });
      component.field = createMockField({ value: 789 });
      expect(component.getDisplayValue()).toBe('789');
    });

    it('should return empty string when field value is null', () => {
      component.config = createMockConfig({ displayValue: undefined });
      component.field = createMockField({ value: null });
      expect(component.getDisplayValue()).toBe('');
    });

    it('should return empty string when field value is undefined', () => {
      component.config = createMockConfig({ displayValue: undefined });
      component.field = createMockField({ value: undefined });
      expect(component.getDisplayValue()).toBe('');
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

  describe('getPlaceholder', () => {
    it('should return config placeholder when set', () => {
      component.config = createMockConfig({ placeholder: 'Enter amount' });
      expect(component.getPlaceholder()).toBe('Enter amount');
    });

    it('should return generated placeholder when config placeholder is undefined', () => {
      component.config = createMockConfig({ placeholder: undefined });
      component.field = createMockField({ name: 'amount' });
      // TranslateModule.forRoot() returns the key when no translations are loaded
      expect(component.getPlaceholder()).toBe('placeholder.enter');
    });

    it('should use displayName if available', () => {
      component.config = createMockConfig({ placeholder: undefined });
      component.field = createMockField({ name: 'amount', displayName: 'Total Amount' });
      // TranslateModule.forRoot() returns the key when no translations are loaded
      expect(component.getPlaceholder()).toBe('placeholder.enter');
    });
  });

  describe('getInputType', () => {
    it('should always return text for better formatting control', () => {
      expect(component.getInputType()).toBe('text');
    });
  });

  describe('isPercentageField', () => {
    it('should return true for percentage field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Percentage' });
      expect(component.isPercentageField()).toBeTrue();
    });

    it('should return false for non-percentage field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Number' });
      expect(component.isPercentageField()).toBeFalse();
    });
  });

  describe('isCurrencyField', () => {
    it('should return true for currency field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Currency' });
      expect(component.isCurrencyField()).toBeTrue();
    });

    it('should return false for non-currency field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Number' });
      expect(component.isCurrencyField()).toBeFalse();
    });
  });

  describe('Event Emitters', () => {
    describe('onValueChange', () => {
      it('should emit valueChange event with new value', () => {
        spyOn(component.valueChange, 'emit');
        component.onValueChange(123);
        expect(component.valueChange.emit).toHaveBeenCalledWith(123);
      });

      it('should emit valueChange event with string value', () => {
        spyOn(component.valueChange, 'emit');
        component.onValueChange('456');
        expect(component.valueChange.emit).toHaveBeenCalledWith('456');
      });
    });

    describe('onBlur', () => {
      it('should emit blur event with value', () => {
        spyOn(component.blur, 'emit');
        component.onBlur(789);
        expect(component.blur.emit).toHaveBeenCalledWith(789);
      });
    });

    describe('onFocus', () => {
      it('should emit focus event', () => {
        spyOn(component.focus, 'emit');
        component.onFocus();
        expect(component.focus.emit).toHaveBeenCalled();
      });
    });
  });

  describe('onKeyPress', () => {
    it('should allow numeric characters', () => {
      spyOn(component.keyPress, 'emit');
      const event = new KeyboardEvent('keypress', { key: '5' });
      const inputElement = document.createElement('input');
      inputElement.value = '12';
      Object.defineProperty(event, 'target', { value: inputElement });
      
      component.onKeyPress(event);
      expect(component.keyPress.emit).toHaveBeenCalledWith(event);
    });

    it('should allow decimal point when not already present', () => {
      spyOn(component.keyPress, 'emit');
      const event = new KeyboardEvent('keypress', { key: '.' });
      const inputElement = document.createElement('input');
      inputElement.value = '12';
      Object.defineProperty(event, 'target', { value: inputElement });
      
      component.onKeyPress(event);
      expect(component.keyPress.emit).toHaveBeenCalledWith(event);
    });

    it('should allow minus sign at start', () => {
      spyOn(component.keyPress, 'emit');
      const event = new KeyboardEvent('keypress', { key: '-' });
      const inputElement = document.createElement('input');
      inputElement.value = '';
      Object.defineProperty(event, 'target', { value: inputElement });
      
      component.onKeyPress(event);
      expect(component.keyPress.emit).toHaveBeenCalledWith(event);
    });

    it('should allow control keys', () => {
      spyOn(component.keyPress, 'emit');
      const event = new KeyboardEvent('keypress', { key: 'Backspace' });
      const inputElement = document.createElement('input');
      inputElement.value = '12';
      Object.defineProperty(event, 'target', { value: inputElement });
      
      component.onKeyPress(event);
      expect(component.keyPress.emit).toHaveBeenCalledWith(event);
    });

    it('should block invalid characters', () => {
      const event = new KeyboardEvent('keypress', { key: 'a', cancelable: true });
      const inputElement = document.createElement('input');
      inputElement.value = '12';
      Object.defineProperty(event, 'target', { value: inputElement });
      
      spyOn(event, 'preventDefault');
      component.onKeyPress(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('onPaste', () => {
    it('should allow valid numeric paste', () => {
      // Create a mock event with clipboardData
      const mockEvent = {
        clipboardData: { getData: () => '123.45' },
        preventDefault: jasmine.createSpy('preventDefault')
      } as unknown as ClipboardEvent;

      component.onPaste(mockEvent);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should block invalid paste', () => {
      // Create a mock event with clipboardData
      const mockEvent = {
        clipboardData: { getData: () => 'abc' },
        preventDefault: jasmine.createSpy('preventDefault')
      } as unknown as ClipboardEvent;

      component.onPaste(mockEvent);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });
});

