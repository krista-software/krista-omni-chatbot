import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalculationFieldComponent } from './calculation-field.component';
import { FormField } from '../../../models/message.model';
import { KristaFieldService } from '../../../services/krista-field.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('CalculationFieldComponent', () => {
  let component: CalculationFieldComponent;
  let fixture: ComponentFixture<CalculationFieldComponent>;
  let mockKristaFieldService: jasmine.SpyObj<KristaFieldService>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testCalculation',
      fieldType: 'com.krista.fields.Calculation',
      value: 100,
      label: 'Test Calculation',
      required: false,
      readOnly: true,
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  beforeEach(async () => {
    mockKristaFieldService = jasmine.createSpyObj('KristaFieldService', ['validateField']);
    mockKristaFieldService.validateField.and.returnValue({ isValid: true, errorMessage: '' });

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [CalculationFieldComponent],
      providers: [
        { provide: KristaFieldService, useValue: mockKristaFieldService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CalculationFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getFormattedValue', () => {
    it('should return formatted number', () => {
      component.field = createMockField({ value: 1234.56 });
      
      const result = component.getFormattedValue();
      
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    it('should return empty string for null value', () => {
      component.field = createMockField({ value: null });
      
      expect(component.getFormattedValue()).toBe('');
    });

    it('should return empty string for undefined value', () => {
      component.field = createMockField({ value: undefined });
      
      expect(component.getFormattedValue()).toBe('');
    });

    it('should format percentage value', () => {
      component.field = createMockField({
        value: 0.25,
        attributeValues: { displayAsPercentage: true }
      });

      const result = component.getFormattedValue();

      expect(result).toContain('25');
      expect(result).toContain('%');
    });

    it('should format currency value', () => {
      component.field = createMockField({
        value: 1000,
        attributeValues: { displayAsCurrency: true, currency: 'USD' }
      });

      const result = component.getFormattedValue();

      expect(result).toContain('$');
      expect(result).toContain('1');
    });

    it('should handle zero value', () => {
      component.field = createMockField({ value: 0 });

      expect(component.getFormattedValue()).toContain('0');
    });

    it('should handle negative values', () => {
      component.field = createMockField({ value: -500 });
      
      const result = component.getFormattedValue();
      
      expect(result).toContain('-');
      expect(result).toContain('500');
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
    it('should always return true for calculation fields', () => {
      component.field = createMockField({ readOnly: false });

      // Calculation fields are always readonly
      expect(component.isFieldReadOnly()).toBeTrue();
    });
  });

  describe('validateField', () => {
    it('should return null (calculation fields are always valid)', () => {
      expect(component.validateField()).toBeNull();
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

    it('should return false when value is 0', () => {
      component.field = createMockField({ value: 0 });
      expect(component.isFieldEmpty()).toBeFalse();
    });

    it('should return false when value is set', () => {
      component.field = createMockField({ value: 100 });
      expect(component.isFieldEmpty()).toBeFalse();
    });
  });

  describe('getDisplayLabel', () => {
    it('should return field name', () => {
      component.field = createMockField({ name: 'Total Amount' });
      expect(component.getDisplayLabel()).toBe('Total Amount');
    });

    it('should return default when no name', () => {
      component.field = createMockField({ name: '' });
      expect(component.getDisplayLabel()).toBe('Calculation');
    });
  });

  describe('getTooltip', () => {
    it('should return tooltip from attributeValues', () => {
      component.field = createMockField({ attributeValues: { toolTip: 'Calculated total' } });
      expect(component.getTooltip()).toBe('Calculated total');
    });

    it('should return empty string when no tooltip', () => {
      component.field = createMockField({ attributeValues: {} });
      expect(component.getTooltip()).toBe('');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customCalculation', value: 500 });
      component.field = field;
      expect(component.field.name).toBe('customCalculation');
      expect(component.field.value).toBe(500);
    });

    it('should accept hasError input', () => {
      component.hasError = true;
      expect(component.hasError).toBeTrue();
    });

    it('should accept errorMessage input', () => {
      component.errorMessage = 'Error';
      expect(component.errorMessage).toBe('Error');
    });
  });

  describe('Formatting Edge Cases', () => {
    it('should handle very large numbers', () => {
      component.field = createMockField({ value: 1000000000 });
      
      const result = component.getFormattedValue();
      
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very small decimal numbers', () => {
      component.field = createMockField({ value: 0.0001 });
      
      const result = component.getFormattedValue();
      
      expect(result).toBeTruthy();
    });

    it('should handle string number values', () => {
      component.field = createMockField({ value: '123.45' as any });
      
      const result = component.getFormattedValue();
      
      expect(result).toContain('123');
    });
  });
});

