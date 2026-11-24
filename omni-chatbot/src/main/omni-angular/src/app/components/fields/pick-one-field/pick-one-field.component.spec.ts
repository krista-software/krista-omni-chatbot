import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PickOneFieldComponent } from './pick-one-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('PickOneFieldComponent', () => {
  let component: PickOneFieldComponent;
  let fixture: ComponentFixture<PickOneFieldComponent>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testPickOne',
      fieldType: 'com.krista.fields.PickOne',
      value: null,
      label: 'Test Pick One',
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
      declarations: [PickOneFieldComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PickOneFieldComponent);
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
        value: 'option2',
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

      expect(component.options.length).toBe(1);
      expect(component.options[0].value).toBe('option2');
    });
  });

  describe('onRadioChange', () => {
    it('should emit selected value', () => {
      spyOn(component.valueChange, 'emit');

      component.onRadioChange('option2');

      expect(component.valueChange.emit).toHaveBeenCalledWith('option2');
    });
  });

  describe('isOptionSelected', () => {
    it('should return true for selected option', () => {
      component.field = createMockField({ value: 'option2' });

      expect(component.isOptionSelected('option2')).toBeTrue();
    });

    it('should return false for non-selected option', () => {
      component.field = createMockField({ value: 'option2' });

      expect(component.isOptionSelected('option1')).toBeFalse();
    });

    it('should return false when no value selected', () => {
      component.field = createMockField({ value: null });

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

  describe('readonly rendering', () => {
    /** Applies field/config and runs the ngOnChanges the template depends on. */
    const render = (readOnly: boolean, value: any = 'option2'): void => {
      component.field = createMockField({ value });
      component.config = createMockConfig({ readOnly });
      component.ngOnChanges({
        field: {
          currentValue: component.field,
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });
      fixture.detectChanges();
    };

    // Readonly renders plain text, not a radio. The readonly option list is
    // filtered to the single selected value, so a radio would always be a lone
    // checked control, and its brand-coloured dot is invisible against the
    // brand-coloured outgoing bubble.
    it('renders the selected label as plain text and no radio group', () => {
      render(true);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.radio-group')).toBeNull();
      expect(el.querySelector('.readonly-value')?.textContent?.trim()).toBe('option2');
    });

    it('renders the radio group when editable', () => {
      render(false);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.radio-group')).not.toBeNull();
      expect(el.querySelector('.readonly-value')).toBeNull();
    });

    it('shows the no-selection message when readonly with no value', () => {
      render(true, null);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.readonly-value')).toBeNull();
      expect(el.querySelector('.no-options-message')?.textContent).toContain('No option selected.');
    });
  });

  describe('getSelectedLabel', () => {
    it('returns the label of the selected option', () => {
      component.field = createMockField({ value: 'option3' });
      component.ngOnChanges({
        field: {
          currentValue: component.field,
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });
      expect(component.getSelectedLabel()).toBe('option3');
    });

    it('returns an empty string when nothing is selected', () => {
      component.field = createMockField({ value: null });
      expect(component.getSelectedLabel()).toBe('');
    });

    it('falls back to the raw value when it matches no option', () => {
      component.field = createMockField({ value: 'unlisted' });
      component.ngOnChanges({
        field: {
          currentValue: component.field,
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });
      expect(component.getSelectedLabel()).toBe('unlisted');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customPickOne' });
      component.field = field;
      expect(component.field.name).toBe('customPickOne');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Selection required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
      expect(component.config.errorMessage).toBe('Selection required');
    });
  });

  describe('trackByValue', () => {
    it('should return option value for tracking', () => {
      const option = { value: 'test', label: 'Test' };
      expect(component.trackByValue(0, option)).toBe('test');
    });
  });
});

