import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynamicFieldComponent } from './dynamic-field.component';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('DynamicFieldComponent', () => {
  let component: DynamicFieldComponent;
  let fixture: ComponentFixture<DynamicFieldComponent>;
  let mockChangeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testField',
      fieldType: 'com.krista.fields.Text',
      value: '',
      label: 'Test Field',
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
    mockChangeDetectorRef = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck', 'detectChanges']);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [DynamicFieldComponent],
      providers: [
        { provide: ChangeDetectorRef, useValue: mockChangeDetectorRef }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getFieldCategory', () => {
    it('should return "text" for Text field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Text' });
      expect(component.getFieldCategory()).toBe('text');
    });

    it('should return "text" for Email field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Email' });
      expect(component.getFieldCategory()).toBe('text');
    });

    it('should return "text" for Phone field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Phone' });
      expect(component.getFieldCategory()).toBe('text');
    });

    it('should return "text" for Paragraph field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Paragraph' });
      expect(component.getFieldCategory()).toBe('text');
    });

    it('should return "number" for Number field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Number' });
      expect(component.getFieldCategory()).toBe('number');
    });

    it('should return "number" for Currency field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Currency' });
      expect(component.getFieldCategory()).toBe('number');
    });

    it('should return "number" for Percentage field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Percentage' });
      expect(component.getFieldCategory()).toBe('number');
    });

    it('should return "date" for Date field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Date' });
      expect(component.getFieldCategory()).toBe('date');
    });

    it('should return "time" for Time field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Time' });
      expect(component.getFieldCategory()).toBe('time');
    });

    it('should return "dateRange" for DateRange field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.DateRange' });
      expect(component.getFieldCategory()).toBe('dateRange');
    });

    it('should return "dateTimeRange" for DateTimeRange field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.DateTimeRange' });
      expect(component.getFieldCategory()).toBe('dateTimeRange');
    });

    it('should return "pickOne" for PickOne field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.PickOne' });
      expect(component.getFieldCategory()).toBe('pickOne');
    });

    it('should return "pickMany" for PickMany field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.PickMany' });
      expect(component.getFieldCategory()).toBe('pickMany');
    });

    it('should return "switch" for Switch field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Switch' });
      expect(component.getFieldCategory()).toBe('switch');
    });

    it('should return "rating" for Rating field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Rating' });
      expect(component.getFieldCategory()).toBe('rating');
    });

    it('should return "file" for File field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.File' });
      expect(component.getFieldCategory()).toBe('file');
    });

    it('should return "file" for Camera field type (Camera uses file category)', () => {
      // Camera field type is mapped to 'file' category in the component
      component.field = createMockField({ fieldType: 'com.krista.fields.Camera' });
      expect(component.getFieldCategory()).toBe('file');
    });

    it('should return "location" for Location field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Location' });
      expect(component.getFieldCategory()).toBe('location');
    });

    it('should return "address" for Address field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Address' });
      expect(component.getFieldCategory()).toBe('address');
    });

    it('should return "unknown" for Multi field type (not in mapping)', () => {
      // Note: 'com.krista.fields.Multi' is NOT in the component's mapping
      // Only 'com.krista.fields.MultiField' is mapped to 'multi'
      component.field = createMockField({ fieldType: 'com.krista.fields.Multi' });
      expect(component.getFieldCategory()).toBe('unknown');
    });

    it('should return "list" for List field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.List' });
      expect(component.getFieldCategory()).toBe('list');
    });

    it('should return "multi" for EntityReference field type', () => {
      // EntityReference is mapped to 'multi' category via isMultiFieldType()
      component.field = createMockField({ fieldType: 'com.krista.fields.EntityReference' });
      expect(component.getFieldCategory()).toBe('multi');
    });

    it('should return "unknown" for Calculation field type (not in mapping)', () => {
      // Note: Calculation field type is NOT in the component's mapping
      component.field = createMockField({ fieldType: 'com.krista.fields.Calculation' });
      expect(component.getFieldCategory()).toBe('unknown');
    });

    it('should return "contentStream" for ContentStream field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.ContentStream' });
      expect(component.getFieldCategory()).toBe('contentStream');
    });

    it('should return "unknown" for unrecognized field type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Unknown' });
      expect(component.getFieldCategory()).toBe('unknown');
    });
  });

  describe('getFieldCategory for text types', () => {
    it('should return text for text field types', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Text' });
      expect(component.getFieldCategory()).toBe('text');
    });

    it('should return number for number field types', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.Number' });
      expect(component.getFieldCategory()).toBe('number');
    });
  });

  describe('getFieldCategory for multi types', () => {
    it('should return "unknown" for Multi field type (not in mapping)', () => {
      // Note: 'com.krista.fields.Multi' is NOT in the component's mapping
      component.field = createMockField({ fieldType: 'com.krista.fields.Multi' });
      expect(component.getFieldCategory()).toBe('unknown');
    });

    it('should return multi for MultiField type', () => {
      component.field = createMockField({ fieldType: 'com.krista.fields.MultiField' });
      expect(component.getFieldCategory()).toBe('multi');
    });
  });

  describe('Event Emitters', () => {
    it('should emit valueChange event', () => {
      spyOn(component.valueChange, 'emit');

      component.onValueChange('new value');

      expect(component.valueChange.emit).toHaveBeenCalledWith('new value');
    });

    it('should emit blur event', () => {
      spyOn(component.blur, 'emit');

      component.onBlur('field-name');

      expect(component.blur.emit).toHaveBeenCalledWith('field-name');
    });

    it('should emit focus event', () => {
      spyOn(component.focus, 'emit');

      component.onFocus();

      expect(component.focus.emit).toHaveBeenCalled();
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customField' });
      component.field = field;
      expect(component.field.name).toBe('customField');
    });

    it('should accept workspaceId input', () => {
      component.workspaceId = 'test-workspace';
      expect(component.workspaceId).toBe('test-workspace');
    });
  });

  describe('getEntitySelectorFieldConfig (KR-21136 entity columns in tables)', () => {
    beforeEach(() => {
      component.field = createMockField({
        fieldType: 'com.krista.fields.Entity',
        attributeValues: {
          selectionSize: '1',
          entityTypeDomain: { entityId: 'e-1', entityName: 'Student' }
        }
      });
    });

    it('propagates showLabel:false from basicFieldConfig (table cells hide labels)', () => {
      component.basicFieldConfig = createMockConfig({ showLabel: false });
      expect(component.getEntitySelectorFieldConfig().showLabel).toBeFalse();
    });

    it('leaves showLabel undefined when not set (standalone fields keep their label)', () => {
      component.basicFieldConfig = createMockConfig();
      expect(component.getEntitySelectorFieldConfig().showLabel).toBeUndefined();
    });

    it('parses entitySelectorMeta from the field attributes', () => {
      component.basicFieldConfig = createMockConfig();
      const config = component.getEntitySelectorFieldConfig();
      expect(config.entitySelectorMeta?.entityTypeDomain?.entityId).toBe('e-1');
    });
  });
});

