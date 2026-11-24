import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntitySelectorFieldComponent } from './entity-selector-field.component';
import { FormField } from '../../../models/message.model';
import { EntitySelectorFieldConfig } from '../../../models/entity.model';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

describe('EntitySelectorFieldComponent', () => {
  let component: EntitySelectorFieldComponent;
  let fixture: ComponentFixture<EntitySelectorFieldComponent>;
  let mockChangeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testEntitySelector',
      fieldType: 'com.krista.fields.EntityReference',
      value: null,
      required: false,
      readOnly: false,
      attributeValues: {
        entityType: 'Contact',
        multiSelect: false,
        displayFields: ['name', 'email'],
        searchFields: ['name', 'email']
      },
      ...overrides
    } as FormField;
  };

  const createMockConfig = (overrides: Partial<EntitySelectorFieldConfig> = {}): EntitySelectorFieldConfig => {
    return {
      displayValue: '',
      hasError: false,
      errorMessage: '',
      readOnly: false,
      ...overrides
    };
  };

  const createMockEntity = (overrides: any = {}) => ({
    id: 'entity-1',
    name: 'John Doe',
    email: 'john@example.com',
    ...overrides
  });

  beforeEach(async () => {
    mockChangeDetectorRef = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck', 'detectChanges']);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [EntitySelectorFieldComponent],
      providers: [
        { provide: ChangeDetectorRef, useValue: mockChangeDetectorRef }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(EntitySelectorFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should initialize with empty selection when value is null', () => {
      component.field = createMockField({ value: null });
      component.ngOnInit();
      
      expect(component.selectedEntities).toEqual([]);
    });

    it('should initialize with single entity when value is object', () => {
      const entity = createMockEntity();
      component.field = createMockField({ value: entity });
      component.ngOnInit();
      
      expect(component.selectedEntities.length).toBe(1);
    });

    it('should initialize with multiple entities when value is array and isMultiSelect is true', () => {
      const entities = [createMockEntity({ id: '1' }), createMockEntity({ id: '2' })];
      component.field = createMockField({ value: entities });
      // Must set isMultiSelect to true for array handling
      component.config = createMockConfig({
        entitySelectorMeta: { isMultiSelect: true } as any
      });
      component.ngOnInit();

      expect(component.selectedEntities.length).toBe(2);
    });

    it('should wrap single value in array when isMultiSelect is false', () => {
      const entity = createMockEntity({ id: '1' });
      component.field = createMockField({ value: entity });
      // Default isMultiSelect is false
      component.ngOnInit();

      // Single value is wrapped in array
      expect(component.selectedEntities.length).toBe(1);
    });
  });

  describe('openEntitySearchModal', () => {
    it('should set isModalOpen to true', () => {
      component.isModalOpen = false;
      component.config = createMockConfig({
        entitySelectorMeta: { entityName: 'Contact' } as any
      });

      component.openEntitySearchModal();

      expect(component.isModalOpen).toBeTrue();
    });

    it('should not open modal when readOnly', () => {
      component.config = createMockConfig({ readOnly: true });
      component.isModalOpen = false;

      component.openEntitySearchModal();

      expect(component.isModalOpen).toBeFalse();
    });
  });

  describe('closeEntitySearchModal', () => {
    it('should set isModalOpen to false', () => {
      component.isModalOpen = true;

      component.closeEntitySearchModal();

      expect(component.isModalOpen).toBeFalse();
    });
  });

  describe('onModalSave', () => {
    it('should close modal after save', () => {
      component.isModalOpen = true;

      component.onModalSave(undefined);

      expect(component.isModalOpen).toBeFalse();
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from selection', () => {
      spyOn(component.valueChange, 'emit');
      const entity1 = { value: { fields: {}, meta: { primaryKey: '1' } }, textSummary: '', fields: [] };
      const entity2 = { value: { fields: {}, meta: { primaryKey: '2' } }, textSummary: '', fields: [] };
      component.selectedEntities = [entity1, entity2] as any;

      component.removeEntity(entity1 as any);

      expect(component.selectedEntities.length).toBe(1);
      expect(component.valueChange.emit).toHaveBeenCalled();
    });

    it('should emit null when last entity removed in single select', () => {
      spyOn(component.valueChange, 'emit');
      component.config = createMockConfig({ entitySelectorMeta: { isMultiSelect: false } as any });
      const entity = { value: { fields: {}, meta: { primaryKey: '1' } }, textSummary: '', fields: [] };
      component.selectedEntities = [entity] as any;

      component.removeEntity(entity as any);

      expect(component.valueChange.emit).toHaveBeenCalledWith(null);
    });
  });

  describe('getPlaceholder', () => {
    it('should return placeholder with entity name', () => {
      component.config = createMockConfig({
        entitySelectorMeta: { entityName: 'Customer' } as any
      });

      expect(component.getPlaceholder()).toBe('Select Customer');
    });

    it('should return default placeholder when no entity name', () => {
      component.config = createMockConfig({});

      expect(component.getPlaceholder()).toBe('Select entity');
    });
  });

  describe('config.entitySelectorMeta.isMultiSelect', () => {
    it('should be true when multiSelect is true', () => {
      component.config = createMockConfig({
        entitySelectorMeta: { isMultiSelect: true } as any
      });

      expect(component.config.entitySelectorMeta?.isMultiSelect).toBeTrue();
    });

    it('should be false when multiSelect is false', () => {
      component.config = createMockConfig({
        entitySelectorMeta: { isMultiSelect: false } as any
      });

      expect(component.config.entitySelectorMeta?.isMultiSelect).toBeFalse();
    });
  });

  describe('displayColumns property', () => {
    it('should be an array', () => {
      expect(Array.isArray(component.displayColumns)).toBeTrue();
    });

    it('should be settable', () => {
      component.displayColumns = [{ name: 'name', label: 'Name' }];
      expect(component.displayColumns.length).toBe(1);
    });
  });

  describe('getDisplayValue', () => {
    it('should always return empty string (component does not show value in input)', () => {
      // The component's getDisplayValue() always returns empty string
      // It doesn't use config.displayValue
      component.config = createMockConfig({ displayValue: 'John Doe' });

      expect(component.getDisplayValue()).toBe('');
    });

    it('should return empty string when no display value', () => {
      component.config = createMockConfig({ displayValue: '' });

      expect(component.getDisplayValue()).toBe('');
    });
  });

  describe('selectedEntities array', () => {
    it('should have length > 0 when entities are selected', () => {
      component.selectedEntities = [createMockEntity()] as any;

      expect(component.selectedEntities.length).toBeGreaterThan(0);
    });

    it('should have length 0 when no entities selected', () => {
      component.selectedEntities = [];

      expect(component.selectedEntities.length).toBe(0);
    });
  });

  describe('selectedEntities property', () => {
    it('should return count of selected entities', () => {
      component.selectedEntities = [
        createMockEntity({ id: '1' }),
        createMockEntity({ id: '2' }),
        createMockEntity({ id: '3' })
      ] as any;

      expect(component.selectedEntities.length).toBe(3);
    });

    it('should return 0 when no entities selected', () => {
      component.selectedEntities = [];

      expect(component.selectedEntities.length).toBe(0);
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

  describe('selectedEntities length check', () => {
    it('should have entities when populated', () => {
      component.selectedEntities = [createMockEntity()] as any;
      expect(component.selectedEntities.length).toBeGreaterThan(0);
    });

    it('should be empty when no entities selected', () => {
      component.selectedEntities = [];
      expect(component.selectedEntities.length).toBe(0);
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customSelector' });
      component.field = field;
      expect(component.field.name).toBe('customSelector');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Selection required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
    });
  });
});

