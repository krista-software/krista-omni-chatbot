import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRangeFieldComponent } from './date-range-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { KristaFieldService } from '../../../services/krista-field.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('DateRangeFieldComponent', () => {
  let component: DateRangeFieldComponent;
  let fixture: ComponentFixture<DateRangeFieldComponent>;
  let mockKristaFieldService: jasmine.SpyObj<KristaFieldService>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testDateRange',
      fieldType: 'com.krista.fields.DateRange',
      value: null,
      label: 'Test Date Range',
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
      declarations: [DateRangeFieldComponent],
      providers: [
        { provide: KristaFieldService, useValue: mockKristaFieldService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(DateRangeFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onStartDateChange', () => {
    it('should emit date range with new start date', () => {
      spyOn(component.valueChange, 'emit');
      const startDate = new Date(2024, 5, 1);
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: null, to: new Date(2024, 5, 15).getTime() } });

      // Component expects event object with 'value' property
      component.onStartDateChange({ value: startDate });

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedValue.from).toBeTruthy();
    });

    it('should emit null when date is cleared', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: { from: Date.now(), to: null } });

      // When start date is cleared, component emits null for entire range
      component.onStartDateChange({ value: null });

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedValue).toBeNull();
    });
  });

  describe('onEndDateChange', () => {
    it('should emit date range with new end date', () => {
      spyOn(component.valueChange, 'emit');
      const endDate = new Date(2024, 5, 30);
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: new Date(2024, 5, 1).getTime(), to: null } });

      // Component expects event object with 'value' property
      component.onEndDateChange({ value: endDate });

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(emittedValue.to).toBeTruthy();
    });

    it('should keep start date when end date is cleared', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: { from: Date.now(), to: Date.now() } });

      // When end date is cleared, component keeps start date
      component.onEndDateChange({ value: null });

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      // Component keeps from date and sets to to null
      expect(emittedValue.from).toBeTruthy();
      expect(emittedValue.to).toBeNull();
    });
  });

  describe('getStartDateValue', () => {
    it('should return Date object for start timestamp', () => {
      const timestamp = new Date(2024, 5, 1).getTime();
      component.field = createMockField({ value: { from: timestamp, to: null } });

      const result = component.getStartDateValue();

      expect(result instanceof Date).toBeTrue();
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(1);
    });

    it('should return null when no start date', () => {
      component.field = createMockField({ value: null });

      expect(component.getStartDateValue()).toBeNull();
    });
  });

  describe('getEndDateValue', () => {
    it('should return Date object for end timestamp', () => {
      const timestamp = new Date(2024, 5, 30).getTime();
      component.field = createMockField({ value: { from: null, to: timestamp } });

      const result = component.getEndDateValue();

      expect(result instanceof Date).toBeTrue();
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(30);
    });

    it('should return null when no end date', () => {
      component.field = createMockField({ value: null });

      expect(component.getEndDateValue()).toBeNull();
    });
  });

  describe('getMinDate', () => {
    it('should return Date from allowedRange.from attribute', () => {
      // Component uses allowedRange.from, not minDate
      const minTimestamp = new Date(2024, 0, 1).getTime();
      component.field = createMockField({ attributeValues: { allowedRange: { from: minTimestamp } } });

      const result = component.getMinDate();

      expect(result instanceof Date).toBeTrue();
    });

    it('should return today when allowPast is false', () => {
      component.field = createMockField({ attributeValues: { allowPast: false } });

      const result = component.getMinDate();

      expect(result instanceof Date).toBeTrue();
    });

    it('should return null when no constraints', () => {
      component.field = createMockField({ attributeValues: {} });

      expect(component.getMinDate()).toBeNull();
    });
  });

  describe('getMaxDate', () => {
    it('should return Date from allowedRange.to attribute', () => {
      // Component uses allowedRange.to, not maxDate
      const maxTimestamp = new Date(2024, 11, 31).getTime();
      component.field = createMockField({ attributeValues: { allowedRange: { to: maxTimestamp } } });

      const result = component.getMaxDate();

      expect(result instanceof Date).toBeTrue();
    });

    it('should return today when allowFuture is false', () => {
      component.field = createMockField({ attributeValues: { allowFuture: false } });

      const result = component.getMaxDate();

      expect(result instanceof Date).toBeTrue();
    });

    it('should return null when no constraints', () => {
      component.field = createMockField({ attributeValues: {} });

      expect(component.getMaxDate()).toBeNull();
    });
  });

  describe('getFormattedDateRangeValue', () => {
    it('should return formatted date range string', () => {
      // Component uses 'from'/'to' not 'start'/'end'
      const from = new Date(2024, 5, 1).getTime();
      const to = new Date(2024, 5, 30).getTime();
      component.field = createMockField({ value: { from, to } });

      const result = component.getFormattedDateRangeValue();

      expect(result).toContain('Jun');
      expect(result).toContain('2024');
    });

    it('should return empty string when no dates', () => {
      component.field = createMockField({ value: null });

      expect(component.getFormattedDateRangeValue()).toBe('');
    });

    it('should handle partial date range (only from)', () => {
      // Component uses 'from'/'to' not 'start'/'end'
      const from = new Date(2024, 5, 1).getTime();
      component.field = createMockField({ value: { from, to: null } });

      const result = component.getFormattedDateRangeValue();

      expect(result).toContain('Jun');
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
      mockKristaFieldService.validateField.and.returnValue({ isValid: false, errorMessage: 'Invalid date range' });
      
      expect(component.validateField()).toBe('Invalid date range');
    });
  });

  describe('isFieldEmpty', () => {
    it('should return true when value is null', () => {
      component.field = createMockField({ value: null });
      expect(component.isFieldEmpty()).toBeTrue();
    });

    it('should return false when both dates are null (object exists)', () => {
      // Component checks for undefined, not null
      // When value is { from: null, to: null }, the range object exists
      // and from/to are null (not undefined), so isFieldEmpty returns false
      component.field = createMockField({ value: { from: null, to: null } });
      expect(component.isFieldEmpty()).toBeFalse();
    });

    it('should return false when from date is set', () => {
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: Date.now(), to: null } });
      expect(component.isFieldEmpty()).toBeFalse();
    });

    it('should return false when to date is set', () => {
      // Component uses 'from'/'to' not 'start'/'end'
      component.field = createMockField({ value: { from: null, to: Date.now() } });
      expect(component.isFieldEmpty()).toBeFalse();
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customDateRange' });
      component.field = field;
      expect(component.field.name).toBe('customDateRange');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Date range required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
    });
  });
});

