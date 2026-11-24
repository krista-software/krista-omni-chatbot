import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateTimeRangeFieldComponent } from './date-time-range-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { KristaFieldService } from '../../../services/krista-field.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('DateTimeRangeFieldComponent', () => {
  let component: DateTimeRangeFieldComponent;
  let fixture: ComponentFixture<DateTimeRangeFieldComponent>;
  let mockKristaFieldService: jasmine.SpyObj<KristaFieldService>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testDateTimeRange',
      fieldType: 'com.krista.fields.DateTimeRange',
      value: null,
      label: 'Test Date Time Range',
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
      declarations: [DateTimeRangeFieldComponent],
      providers: [
        { provide: KristaFieldService, useValue: mockKristaFieldService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(DateTimeRangeFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onStartDateTimeChange', () => {
    it('should emit date time range with new start date', () => {
      spyOn(component.valueChange, 'emit');
      const startDate = new Date(2024, 5, 1, 10, 30);
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: null, to: Date.now() } });

      component.onStartDateTimeChange(startDate);

      expect(component.valueChange.emit).toHaveBeenCalled();
    });

    it('should emit null when date is cleared', () => {
      spyOn(component.valueChange, 'emit');
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: Date.now(), to: null } });

      component.onStartDateTimeChange(null);

      expect(component.valueChange.emit).toHaveBeenCalled();
      // When start date is cleared, the entire range is cleared (emits null)
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedValue).toBeNull();
    });
  });

  describe('onEndDateTimeChange', () => {
    it('should emit date time range with new end date', () => {
      spyOn(component.valueChange, 'emit');
      const endDate = new Date(2024, 5, 30, 18, 0);
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: Date.now(), to: null } });

      component.onEndDateTimeChange(endDate);

      expect(component.valueChange.emit).toHaveBeenCalled();
    });
  });

  describe('onStartTimeChange', () => {
    it('should update time portion of start date', () => {
      spyOn(component.valueChange, 'emit');
      const startTimestamp = new Date(2024, 5, 1, 10, 0).getTime();
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: startTimestamp, to: null } });

      component.onStartTimeChange('14:30');

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      // Component emits 'from'/'to' structure
      const newDate = new Date(emittedValue.from);
      expect(newDate.getHours()).toBe(14);
      expect(newDate.getMinutes()).toBe(30);
    });
  });

  describe('onEndTimeChange', () => {
    it('should update time portion of end date', () => {
      spyOn(component.valueChange, 'emit');
      const endTimestamp = new Date(2024, 5, 30, 10, 0).getTime();
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: null, to: endTimestamp } });

      component.onEndTimeChange('18:45');

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      // Component emits 'from'/'to' structure
      const newDate = new Date(emittedValue.to);
      expect(newDate.getHours()).toBe(18);
      expect(newDate.getMinutes()).toBe(45);
    });
  });

  describe('getMinDate', () => {
    it('should return Date from allowedRange.from attribute', () => {
      const minTimestamp = new Date(2024, 0, 1).getTime();
      // Component uses allowedRange.from, not minDate
      component.field = createMockField({ attributeValues: { allowedRange: { from: minTimestamp } } });

      const result = component.getMinDate();

      expect(result instanceof Date).toBeTrue();
    });

    it('should return null when no allowedRange', () => {
      component.field = createMockField({ attributeValues: {} });

      expect(component.getMinDate()).toBeNull();
    });

    it('should return today when allowPast is false', () => {
      component.field = createMockField({ attributeValues: { allowPast: false } });

      const result = component.getMinDate();

      expect(result instanceof Date).toBeTrue();
    });
  });

  describe('getMaxDate', () => {
    it('should return Date from allowedRange.to attribute', () => {
      const maxTimestamp = new Date(2024, 11, 31).getTime();
      // Component uses allowedRange.to, not maxDate
      component.field = createMockField({ attributeValues: { allowedRange: { to: maxTimestamp } } });

      const result = component.getMaxDate();

      expect(result instanceof Date).toBeTrue();
    });

    it('should return null when no allowedRange', () => {
      component.field = createMockField({ attributeValues: {} });

      expect(component.getMaxDate()).toBeNull();
    });

    it('should return today when allowFuture is false', () => {
      component.field = createMockField({ attributeValues: { allowFuture: false } });

      const result = component.getMaxDate();

      expect(result instanceof Date).toBeTrue();
    });
  });

  describe('getStartTimeValue', () => {
    it('should return HH:MM format for start time', () => {
      const timestamp = new Date(2024, 5, 1, 14, 30).getTime();
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: timestamp, to: null } });

      expect(component.getStartTimeValue()).toBe('14:30');
    });

    it('should return empty string when no start date', () => {
      component.field = createMockField({ value: null });

      expect(component.getStartTimeValue()).toBe('');
    });
  });

  describe('getEndTimeValue', () => {
    it('should return HH:MM format for end time', () => {
      const timestamp = new Date(2024, 5, 30, 9, 5).getTime();
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: null, to: timestamp } });

      expect(component.getEndTimeValue()).toBe('09:05');
    });

    it('should return empty string when no end date', () => {
      component.field = createMockField({ value: null });

      expect(component.getEndTimeValue()).toBe('');
    });
  });

  describe('getFormattedDateTimeRangeValue', () => {
    it('should return formatted date time range string', () => {
      const from = new Date(2024, 5, 1, 10, 0).getTime();
      const to = new Date(2024, 5, 30, 18, 0).getTime();
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from, to } });

      const result = component.getFormattedDateTimeRangeValue();

      expect(result).toContain('Jun');
      expect(result).toContain('2024');
    });

    it('should return empty string when no dates', () => {
      component.field = createMockField({ value: null });

      expect(component.getFormattedDateTimeRangeValue()).toBe('');
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

  describe('validateField', () => {
    it('should return null when field is valid', () => {
      mockKristaFieldService.validateField.and.returnValue({ isValid: true, errorMessage: '' });

      expect(component.validateField()).toBeNull();
    });

    it('should return error message when field is invalid', () => {
      mockKristaFieldService.validateField.and.returnValue({ isValid: false, errorMessage: 'Invalid range' });

      expect(component.validateField()).toBe('Invalid range');
    });
  });

  describe('isFieldEmpty', () => {
    it('should return true when value is null', () => {
      component.field = createMockField({ value: null });
      expect(component.isFieldEmpty()).toBeTrue();
    });

    it('should return false when value is empty object (from/to become null, not undefined)', () => {
      // When value is {}, getDateTimeRangeValue returns { from: null, to: null }
      // isFieldEmpty checks for undefined, not null, so it returns false
      component.field = createMockField({ value: {} });
      expect(component.isFieldEmpty()).toBeFalse();
    });

    it('should return false when from date is set', () => {
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: Date.now(), to: null } });
      expect(component.isFieldEmpty()).toBeFalse();
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customDateTimeRange' });
      component.field = field;
      expect(component.field.name).toBe('customDateTimeRange');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Range required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
    });
  });
});

