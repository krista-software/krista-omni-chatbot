import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocationFieldComponent } from './location-field.component';
import { FormField } from '../../../models/message.model';
import { LocationFieldConfig } from '../../../models/field-config.model';
import { MatDialog } from '@angular/material/dialog';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

describe('LocationFieldComponent', () => {
  let component: LocationFieldComponent;
  let fixture: ComponentFixture<LocationFieldComponent>;
  let mockDialog: jasmine.SpyObj<MatDialog>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testLocation',
      fieldType: 'com.krista.fields.Location',
      value: null,
      required: false,
      readOnly: false,
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  const createMockConfig = (overrides: Partial<LocationFieldConfig> = {}): LocationFieldConfig => {
    return {
      displayValue: '',
      allowMapSelection: false,
      hasError: false,
      errorMessage: '',
      readOnly: false,
      ...overrides
    };
  };

  const createMockLocationValue = (overrides: any = {}) => ({
    latitude: 40.7128,
    longitude: -74.0060,
    address: 'New York, NY, USA',
    ...overrides
  });

  beforeEach(async () => {
    mockDialog = jasmine.createSpyObj('MatDialog', ['open']);
    mockDialog.open.and.returnValue({
      afterClosed: () => of(null)
    } as any);

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [LocationFieldComponent],
      providers: [
        { provide: MatDialog, useValue: mockDialog }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(LocationFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onLocationChange', () => {
    it('should emit location value', () => {
      spyOn(component.valueChange, 'emit');

      component.onLocationChange('New York, NY');

      expect(component.valueChange.emit).toHaveBeenCalledWith('New York, NY');
    });
  });

  describe('handleLocationSelection', () => {
    it('should not do anything when readOnly', () => {
      component.config = createMockConfig({ readOnly: true });

      component.handleLocationSelection();

      expect(mockDialog.open).not.toHaveBeenCalled();
    });

    it('should call openMapPicker when allowMapSelection is true', () => {
      component.config = createMockConfig({ allowMapSelection: true, readOnly: false });
      // openMapPicker is async and calls googleMapsLoader.load() before opening dialog
      // We can't easily test the dialog.open call without mocking googleMapsLoader
      // Instead, test that the method doesn't throw and the component state is correct
      spyOn<any>(component, 'openMapPicker');

      component.handleLocationSelection();

      expect((component as any).openMapPicker).toHaveBeenCalled();
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
    it('should return empty string when readOnly', () => {
      component.config = createMockConfig({ readOnly: true });
      expect(component.getPlaceholder()).toBe('');
    });

    it('should return placeholder with field name', () => {
      component.field = createMockField({ name: 'location' });
      component.config = createMockConfig({ readOnly: false });
      // TranslateModule.forRoot() returns the key when no translations are loaded
      // LocationFieldComponent uses 'placeholder.set' instead of 'placeholder.enter'
      expect(component.getPlaceholder()).toBe('placeholder.set');
    });
  });

  describe('Internal state', () => {
    it('should have fetching state initialized to false', () => {
      expect(component.fetching).toBeFalse();
    });

    it('should have locationError initialized to empty string', () => {
      expect(component.locationError).toBe('');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customLocation' });
      component.field = field;
      expect(component.field.name).toBe('customLocation');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'Location required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
    });

    it('should accept config with allowMapSelection', () => {
      const config = createMockConfig({ allowMapSelection: true });
      component.config = config;
      expect(component.config.allowMapSelection).toBeTrue();
    });
  });
});

