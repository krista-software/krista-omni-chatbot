import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwitchFieldComponent } from './switch-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('SwitchFieldComponent', () => {
  let component: SwitchFieldComponent;
  let fixture: ComponentFixture<SwitchFieldComponent>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testSwitch',
      fieldType: 'com.krista.fields.Switch',
      value: false,
      label: 'Test Switch',
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
    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [SwitchFieldComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(SwitchFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should initialize value to false when null', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: null });
      component.ngOnInit();
      expect(component.field.value).toBe(false);
      expect(component.valueChange.emit).toHaveBeenCalledWith(false);
    });

    it('should initialize value to false when undefined', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: undefined });
      component.ngOnInit();
      expect(component.field.value).toBe(false);
      expect(component.valueChange.emit).toHaveBeenCalledWith(false);
    });

    it('should not change value when already set to true', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: true });
      component.ngOnInit();
      expect(component.field.value).toBe(true);
      expect(component.valueChange.emit).not.toHaveBeenCalled();
    });

    it('should not change value when already set to false', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: false });
      component.ngOnInit();
      expect(component.field.value).toBe(false);
      expect(component.valueChange.emit).not.toHaveBeenCalled();
    });
  });

  describe('onToggleClick', () => {
    it('should toggle from false to true', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: false });
      component.config = createMockConfig({ readOnly: false });
      
      component.onToggleClick();
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(true);
    });

    it('should toggle from true to false', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: true });
      component.config = createMockConfig({ readOnly: false });
      
      component.onToggleClick();
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(false);
    });

    it('should not toggle when readOnly from config', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: false });
      component.config = createMockConfig({ readOnly: true });
      
      component.onToggleClick();
      
      expect(component.valueChange.emit).not.toHaveBeenCalled();
    });

    it('should not toggle when readOnly from field', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: false, readOnly: true });
      component.config = createMockConfig({ readOnly: false });
      
      component.onToggleClick();
      
      expect(component.valueChange.emit).not.toHaveBeenCalled();
    });

    it('should handle truthy values correctly', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: 1 as any });
      component.config = createMockConfig({ readOnly: false });
      
      component.onToggleClick();
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(false);
    });

    it('should handle falsy values correctly', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: 0 as any });
      component.config = createMockConfig({ readOnly: false });
      
      component.onToggleClick();
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(true);
    });
  });

  describe('getCurrentValue', () => {
    it('should return true when value is true', () => {
      component.field = createMockField({ value: true });
      expect(component.getCurrentValue()).toBeTrue();
    });

    it('should return false when value is false', () => {
      component.field = createMockField({ value: false });
      expect(component.getCurrentValue()).toBeFalse();
    });

    it('should return true for truthy values', () => {
      component.field = createMockField({ value: 1 as any });
      expect(component.getCurrentValue()).toBeTrue();
    });

    it('should return false for falsy values', () => {
      component.field = createMockField({ value: 0 as any });
      expect(component.getCurrentValue()).toBeFalse();
    });

    it('should return false for null', () => {
      component.field = createMockField({ value: null });
      expect(component.getCurrentValue()).toBeFalse();
    });

    it('should return false for undefined', () => {
      component.field = createMockField({ value: undefined });
      expect(component.getCurrentValue()).toBeFalse();
    });

    it('should return true for non-empty string', () => {
      component.field = createMockField({ value: 'yes' as any });
      expect(component.getCurrentValue()).toBeTrue();
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

    it('should return false when required is undefined', () => {
      component.field = createMockField({ required: undefined });
      expect(component.isFieldRequired()).toBeFalse();
    });
  });

  describe('isFieldReadOnly', () => {
    it('should return true when config readOnly is true', () => {
      component.config = createMockConfig({ readOnly: true });
      component.field = createMockField({ readOnly: false });
      expect(component.isFieldReadOnly()).toBeTrue();
    });

    it('should return true when field readOnly is true', () => {
      component.config = createMockConfig({ readOnly: false });
      component.field = createMockField({ readOnly: true });
      expect(component.isFieldReadOnly()).toBeTrue();
    });

    it('should return false when both are false', () => {
      component.config = createMockConfig({ readOnly: false });
      component.field = createMockField({ readOnly: false });
      expect(component.isFieldReadOnly()).toBeFalse();
    });

    it('should return true when both are true', () => {
      component.config = createMockConfig({ readOnly: true });
      component.field = createMockField({ readOnly: true });
      expect(component.isFieldReadOnly()).toBeTrue();
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customSwitch' });
      component.field = field;
      expect(component.field.name).toBe('customSwitch');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Error' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
      expect(component.config.errorMessage).toBe('Error');
    });
  });
});

