import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateFieldComponent } from './date-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { KristaFieldService } from '../../../services/krista-field.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';

describe('DateFieldComponent', () => {
  let component: DateFieldComponent;
  let fixture: ComponentFixture<DateFieldComponent>;
  let mockKristaFieldService: jasmine.SpyObj<KristaFieldService>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testDate',
      fieldType: 'com.krista.fields.Date',
      value: null,
      label: 'Test Date',
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

    const mockMatDialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [DateFieldComponent],
      providers: [
        { provide: KristaFieldService, useValue: mockKristaFieldService },
        { provide: MatDialog, useValue: mockMatDialog }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(DateFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onDateChange', () => {
    it('should emit timestamp for valid date', () => {
      spyOn(component.valueChange, 'emit');
      const testDate = new Date(2024, 5, 15); // June 15, 2024

      // Component expects event object with 'value' property
      component.onDateChange({ value: testDate });

      expect(component.valueChange.emit).toHaveBeenCalled();
      const emittedValue = (component.valueChange.emit as jasmine.Spy).calls.mostRecent().args[0];
      expect(typeof emittedValue).toBe('number');
    });

    it('should emit undefined for null date', () => {
      spyOn(component.valueChange, 'emit');

      // Component expects event object with 'value' property
      component.onDateChange({ value: null });

      expect(component.valueChange.emit).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getDateValue', () => {
    it('should return Date object for timestamp', () => {
      const timestamp = new Date(2024, 5, 15).getTime();
      component.field = createMockField({ value: timestamp });
      
      const result = component.getDateValue();
      
      expect(result instanceof Date).toBeTrue();
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(15);
    });

    it('should return null for null value', () => {
      component.field = createMockField({ value: null });
      
      expect(component.getDateValue()).toBeNull();
    });

    it('should return null for undefined value', () => {
      component.field = createMockField({ value: undefined });
      
      expect(component.getDateValue()).toBeNull();
    });
  });

  describe('getMinDate', () => {
    it('should return Date from minDate attribute', () => {
      const minTimestamp = new Date(2024, 0, 1).getTime();
      component.field = createMockField({ attributeValues: { minDate: minTimestamp } });
      
      const result = component.getMinDate();
      
      expect(result instanceof Date).toBeTrue();
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0);
    });

    it('should return null when no minDate attribute', () => {
      component.field = createMockField({ attributeValues: {} });
      
      expect(component.getMinDate()).toBeNull();
    });
  });

  describe('getMaxDate', () => {
    it('should return Date from maxDate attribute', () => {
      const maxTimestamp = new Date(2024, 11, 31).getTime();
      component.field = createMockField({ attributeValues: { maxDate: maxTimestamp } });
      
      const result = component.getMaxDate();
      
      expect(result instanceof Date).toBeTrue();
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(11);
    });

    it('should return null when no maxDate attribute', () => {
      component.field = createMockField({ attributeValues: {} });
      
      expect(component.getMaxDate()).toBeNull();
    });
  });

  describe('dateFilter', () => {
    it('should return true for valid date within range', () => {
      const minTimestamp = new Date(2024, 0, 1).getTime();
      const maxTimestamp = new Date(2024, 11, 31).getTime();
      component.field = createMockField({ 
        attributeValues: { minDate: minTimestamp, maxDate: maxTimestamp } 
      });
      
      const testDate = new Date(2024, 5, 15);
      expect(component.dateFilter(testDate)).toBeTrue();
    });

    it('should return false for date before minDate', () => {
      const minTimestamp = new Date(2024, 0, 1).getTime();
      component.field = createMockField({ attributeValues: { minDate: minTimestamp } });
      
      const testDate = new Date(2023, 11, 31);
      expect(component.dateFilter(testDate)).toBeFalse();
    });

    it('should return false for date after maxDate', () => {
      const maxTimestamp = new Date(2024, 11, 31).getTime();
      component.field = createMockField({ attributeValues: { maxDate: maxTimestamp } });
      
      const testDate = new Date(2025, 0, 1);
      expect(component.dateFilter(testDate)).toBeFalse();
    });

    it('should return true when no date constraints', () => {
      component.field = createMockField({ attributeValues: {} });
      
      const testDate = new Date(2024, 5, 15);
      expect(component.dateFilter(testDate)).toBeTrue();
    });

    it('should return true for null date (component allows null)', () => {
      // The component returns true for null dates
      expect(component.dateFilter(null)).toBeTrue();
    });
  });

  describe('getFormattedDate', () => {
    it('should return formatted date string', () => {
      const timestamp = new Date(2024, 5, 15).getTime();
      component.field = createMockField({ value: timestamp });

      const result = component.getFormattedDateValue();

      expect(result).toContain('2024');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
    });

    it('should return empty string for null value', () => {
      component.field = createMockField({ value: null });

      expect(component.getFormattedDateValue()).toBe('');
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
      mockKristaFieldService.validateField.and.returnValue({ isValid: false, errorMessage: 'Invalid date' });
      
      expect(component.validateField()).toBe('Invalid date');
    });
  });

  describe('isFieldEmpty', () => {
    it('should return true when value is null', () => {
      component.field = createMockField({ value: null });
      expect(component.isFieldEmpty()).toBeTrue();
    });

    it('should return true when value is undefined', () => {
      component.field = createMockField({ value: undefined });
      expect(component.isFieldEmpty()).toBeTrue();
    });

    it('should return false when value is set', () => {
      component.field = createMockField({ value: Date.now() });
      expect(component.isFieldEmpty()).toBeFalse();
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customDate' });
      component.field = field;
      expect(component.field.name).toBe('customDate');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Date required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
      expect(component.config.errorMessage).toBe('Date required');
    });
  });
});

