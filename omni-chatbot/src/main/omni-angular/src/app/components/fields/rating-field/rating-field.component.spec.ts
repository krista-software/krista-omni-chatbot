import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RatingFieldComponent } from './rating-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('RatingFieldComponent', () => {
  let component: RatingFieldComponent;
  let fixture: ComponentFixture<RatingFieldComponent>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testRating',
      fieldType: 'com.krista.fields.Rating',
      value: 0,
      label: 'Test Rating',
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
      declarations: [RatingFieldComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(RatingFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('maxRating', () => {
    it('should return default 5 when no maxRating attribute', () => {
      component.field = createMockField({ attributeValues: {} });
      expect(component.maxRating).toBe(5);
    });

    it('should return custom maxRating from attributeValues', () => {
      component.field = createMockField({ attributeValues: { maxRating: 10 } });
      expect(component.maxRating).toBe(10);
    });

    it('should return default 5 when maxRating is 0', () => {
      component.field = createMockField({ attributeValues: { maxRating: 0 } });
      expect(component.maxRating).toBe(5);
    });

    it('should return default 5 when maxRating is negative', () => {
      component.field = createMockField({ attributeValues: { maxRating: -3 } });
      expect(component.maxRating).toBe(5);
    });

    it('should return default 5 when maxRating is not a number', () => {
      component.field = createMockField({ attributeValues: { maxRating: 'five' } });
      expect(component.maxRating).toBe(5);
    });
  });

  describe('stars', () => {
    it('should return array of 5 stars by default', () => {
      component.field = createMockField({ attributeValues: {} });
      expect(component.stars).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return array of custom length', () => {
      component.field = createMockField({ attributeValues: { maxRating: 3 } });
      expect(component.stars).toEqual([1, 2, 3]);
    });

    it('should return array of 10 stars when maxRating is 10', () => {
      component.field = createMockField({ attributeValues: { maxRating: 10 } });
      expect(component.stars.length).toBe(10);
      expect(component.stars[0]).toBe(1);
      expect(component.stars[9]).toBe(10);
    });
  });

  describe('onStarClick', () => {
    it('should emit rating value when clicked', () => {
      spyOn(component.valueChange, 'emit');
      component.config = createMockConfig({ readOnly: false });
      
      component.onStarClick(3);
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(3);
    });

    it('should not emit when readOnly from config', () => {
      spyOn(component.valueChange, 'emit');
      component.config = createMockConfig({ readOnly: true });
      
      component.onStarClick(3);
      
      expect(component.valueChange.emit).not.toHaveBeenCalled();
    });

    it('should not emit when readOnly from field', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ readOnly: true });
      component.config = createMockConfig({ readOnly: false });
      
      component.onStarClick(3);
      
      expect(component.valueChange.emit).not.toHaveBeenCalled();
    });

    it('should emit 1 when first star clicked', () => {
      spyOn(component.valueChange, 'emit');
      component.config = createMockConfig({ readOnly: false });
      
      component.onStarClick(1);
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(1);
    });

    it('should emit max rating when last star clicked', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ attributeValues: { maxRating: 10 } });
      component.config = createMockConfig({ readOnly: false });
      
      component.onStarClick(10);
      
      expect(component.valueChange.emit).toHaveBeenCalledWith(10);
    });
  });

  describe('isStarFilled', () => {
    it('should return true for stars up to current value', () => {
      component.field = createMockField({ value: 3 });
      
      expect(component.isStarFilled(1)).toBeTrue();
      expect(component.isStarFilled(2)).toBeTrue();
      expect(component.isStarFilled(3)).toBeTrue();
    });

    it('should return false for stars above current value', () => {
      component.field = createMockField({ value: 3 });
      
      expect(component.isStarFilled(4)).toBeFalse();
      expect(component.isStarFilled(5)).toBeFalse();
    });

    it('should return false for all stars when value is 0', () => {
      component.field = createMockField({ value: 0 });
      
      expect(component.isStarFilled(1)).toBeFalse();
      expect(component.isStarFilled(2)).toBeFalse();
      expect(component.isStarFilled(3)).toBeFalse();
    });

    it('should return true for all stars when value equals max', () => {
      component.field = createMockField({ value: 5 });
      
      expect(component.isStarFilled(1)).toBeTrue();
      expect(component.isStarFilled(2)).toBeTrue();
      expect(component.isStarFilled(3)).toBeTrue();
      expect(component.isStarFilled(4)).toBeTrue();
      expect(component.isStarFilled(5)).toBeTrue();
    });

    it('should handle null value as 0', () => {
      component.field = createMockField({ value: null });
      
      expect(component.isStarFilled(1)).toBeFalse();
    });

    it('should handle undefined value as 0', () => {
      component.field = createMockField({ value: undefined });
      
      expect(component.isStarFilled(1)).toBeFalse();
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
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customRating', value: 4 });
      component.field = field;
      expect(component.field.name).toBe('customRating');
      expect(component.field.value).toBe(4);
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Rating required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
      expect(component.config.errorMessage).toBe('Rating required');
    });
  });
});

