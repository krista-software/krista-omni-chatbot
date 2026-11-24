import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeFieldComponent } from './time-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { KristaFieldService } from '../../../services/krista-field.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('TimeFieldComponent', () => {
  let component: TimeFieldComponent;
  let fixture: ComponentFixture<TimeFieldComponent>;
  let mockKristaFieldService: jasmine.SpyObj<KristaFieldService>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testTime',
      fieldType: 'com.krista.fields.Time',
      value: null,
      label: 'Test Time',
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
    mockKristaFieldService = jasmine.createSpyObj('KristaFieldService', ['validateField']);
    mockKristaFieldService.validateField.and.returnValue({ isValid: true, errorMessage: '' });

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [TimeFieldComponent],
      providers: [
        { provide: KristaFieldService, useValue: mockKristaFieldService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(TimeFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should convert HH:MM string to timestamp', () => {
      component.field = createMockField({ value: '14:30' });
      component.ngOnInit();
      
      expect(typeof component.field.value).toBe('number');
      const date = new Date(component.field.value);
      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(30);
    });

    it('should convert HH:MM:SS string to timestamp', () => {
      component.field = createMockField({ value: '09:15:00' });
      component.ngOnInit();
      
      expect(typeof component.field.value).toBe('number');
      const date = new Date(component.field.value);
      expect(date.getHours()).toBe(9);
      expect(date.getMinutes()).toBe(15);
    });

    it('should keep timestamp value unchanged', () => {
      const timestamp = new Date().setHours(10, 30, 0, 0);
      component.field = createMockField({ value: timestamp });
      component.ngOnInit();
      
      expect(component.field.value).toBe(timestamp);
    });

    it('should handle null value', () => {
      component.field = createMockField({ value: null });
      component.ngOnInit();
      
      expect(component.field.value).toBeNull();
    });
  });

  describe('onTimeChange', () => {
    it('should emit timestamp for valid time string', () => {
      spyOn(component.valueChange, 'emit');
      
      component.onTimeChange('15:45');
      
      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      const date = new Date(emittedValue);
      expect(date.getHours()).toBe(15);
      expect(date.getMinutes()).toBe(45);
    });

    it('should emit undefined for empty string', () => {
      spyOn(component.valueChange, 'emit');
      
      component.onTimeChange('');
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getFormattedTimeValue', () => {
    it('should return HH:MM format for timestamp', () => {
      const date = new Date();
      date.setHours(14, 30, 0, 0);
      component.field = createMockField({ value: date.getTime() });
      
      expect(component.getFormattedTimeValue()).toBe('14:30');
    });

    it('should return empty string for null value', () => {
      component.field = createMockField({ value: null });
      
      expect(component.getFormattedTimeValue()).toBe('');
    });

    it('should pad single digit hours and minutes', () => {
      const date = new Date();
      date.setHours(9, 5, 0, 0);
      component.field = createMockField({ value: date.getTime() });
      
      expect(component.getFormattedTimeValue()).toBe('09:05');
    });

    it('should handle midnight correctly', () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      component.field = createMockField({ value: date.getTime() });
      
      expect(component.getFormattedTimeValue()).toBe('00:00');
    });
  });

  describe('getDisplayTimeValue', () => {
    it('should return 12-hour format with AM', () => {
      const date = new Date();
      date.setHours(9, 30, 0, 0);
      component.field = createMockField({ value: date.getTime() });
      
      expect(component.getDisplayTimeValue()).toBe('9:30 AM');
    });

    it('should return 12-hour format with PM', () => {
      const date = new Date();
      date.setHours(14, 45, 0, 0);
      component.field = createMockField({ value: date.getTime() });
      
      expect(component.getDisplayTimeValue()).toBe('2:45 PM');
    });

    it('should handle noon correctly', () => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      component.field = createMockField({ value: date.getTime() });
      
      expect(component.getDisplayTimeValue()).toBe('12:00 PM');
    });

    it('should handle midnight correctly', () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      component.field = createMockField({ value: date.getTime() });
      
      expect(component.getDisplayTimeValue()).toBe('12:00 AM');
    });

    it('should return empty string for null value', () => {
      component.field = createMockField({ value: null });

      expect(component.getDisplayTimeValue()).toBe('');
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

  describe('getPlaceholder', () => {
    it('should return HH:MM when not readOnly', () => {
      component.config = createMockConfig({ readOnly: false });
      expect(component.getPlaceholder()).toBe('HH:MM');
    });

    it('should return empty string when readOnly', () => {
      component.config = createMockConfig({ readOnly: true });
      expect(component.getPlaceholder()).toBe('');
    });
  });

  describe('validateField', () => {
    it('should return null when field is valid', () => {
      mockKristaFieldService.validateField.and.returnValue({ isValid: true, errorMessage: '' });
      
      expect(component.validateField()).toBeNull();
    });

    it('should return error message when field is invalid', () => {
      mockKristaFieldService.validateField.and.returnValue({ isValid: false, errorMessage: 'Invalid time' });
      
      expect(component.validateField()).toBe('Invalid time');
    });
  });

  describe('isFieldEmpty', () => {
    it('should return true when value is null', () => {
      component.field = createMockField({ value: null });
      expect(component.isFieldEmpty()).toBeTrue();
    });

    it('should return true when value is empty string', () => {
      component.field = createMockField({ value: '' });
      expect(component.isFieldEmpty()).toBeTrue();
    });

    it('should return false when value is set', () => {
      component.field = createMockField({ value: Date.now() });
      expect(component.isFieldEmpty()).toBeFalse();
    });
  });
});

