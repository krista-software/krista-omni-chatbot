import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PickManyFieldComponent } from './pick-many-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('PickManyFieldComponent', () => {
  let component: PickManyFieldComponent;
  let fixture: ComponentFixture<PickManyFieldComponent>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testPickMany',
      fieldType: 'com.krista.fields.PickMany',
      value: [],
      label: 'Test Pick Many',
      required: false,
      readOnly: false,
      attributeValues: {
        options: ['option1', 'option2', 'option3']
      },
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
      declarations: [PickManyFieldComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PickManyFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnChanges', () => {
    it('should calculate options on field change', () => {
      component.field = createMockField({
        attributeValues: {
          options: ['a', 'b']
        }
      });

      component.ngOnChanges({
        field: {
          currentValue: component.field,
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });

      expect(component.options.length).toBe(2);
    });

    it('should filter options in readonly mode to show only selected', () => {
      component.field = createMockField({
        value: ['option1', 'option3'],
        attributeValues: {
          options: ['option1', 'option2', 'option3']
        }
      });
      component.config = createMockConfig({ readOnly: true });

      component.ngOnChanges({
        field: {
          currentValue: component.field,
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });

      expect(component.options.length).toBe(2);
      expect(component.options.map((o: any) => o.value)).toContain('option1');
      expect(component.options.map((o: any) => o.value)).toContain('option3');
    });
  });

  describe('onCheckboxChange', () => {
    it('should add value when checked', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: ['option1'] });

      component.onCheckboxChange('option2', true);

      expect(component.valueChange.emit).toHaveBeenCalledWith(['option1', 'option2']);
    });

    it('should remove value when unchecked', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: ['option1', 'option2'] });

      component.onCheckboxChange('option1', false);

      expect(component.valueChange.emit).toHaveBeenCalledWith(['option2']);
    });

    it('should handle null value array', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: null });

      component.onCheckboxChange('option1', true);

      expect(component.valueChange.emit).toHaveBeenCalledWith(['option1']);
    });
  });

  describe('isOptionSelected', () => {
    it('should return true for selected option', () => {
      component.field = createMockField({ value: ['option1', 'option2'] });

      expect(component.isOptionSelected('option2')).toBeTrue();
    });

    it('should return false for non-selected option', () => {
      component.field = createMockField({ value: ['option1'] });

      expect(component.isOptionSelected('option2')).toBeFalse();
    });

    it('should return false when value is null', () => {
      component.field = createMockField({ value: null });

      expect(component.isOptionSelected('option1')).toBeFalse();
    });

    it('should return false when value is empty array', () => {
      component.field = createMockField({ value: [] });

      expect(component.isOptionSelected('option1')).toBeFalse();
    });
  });

  describe('options getter', () => {
    it('should return options from attributeValues', () => {
      component.field = createMockField({
        attributeValues: {
          options: ['a', 'b']
        }
      });

      component.ngOnChanges({
        field: {
          currentValue: component.field,
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });

      expect(component.options.length).toBe(2);
      expect(component.options[0].value).toBe('a');
      expect(component.options[1].value).toBe('b');
    });

    it('should return empty array when no options', () => {
      component.field = createMockField({ attributeValues: {} });

      component.ngOnChanges({
        field: {
          currentValue: component.field,
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });

      expect(component.options).toEqual([]);
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

  describe('trackByValue', () => {
    it('should return option value for tracking', () => {
      const option = { value: 'test', label: 'Test' };
      expect(component.trackByValue(0, option)).toBe('test');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customPickMany' });
      component.field = field;
      expect(component.field.name).toBe('customPickMany');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Selection required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
      expect(component.config.errorMessage).toBe('Selection required');
    });
  });
});

