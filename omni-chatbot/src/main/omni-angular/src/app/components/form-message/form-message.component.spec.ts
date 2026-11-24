import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormMessageComponent } from './form-message.component';
import { KristaFieldService } from '../../services/krista-field.service';
import { KristaFieldFactoryService } from '../../services/krista-field-factory.service';
import { ConfigService } from '../../services/config.service';
import { StorageService } from '../../services/storage.service';
import { KSDKMessage, MessageType, SubmitType, FormField } from '../../../ui-toolkit-src-angular';
import { KristaField } from '../../models/krista-field.model';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('FormMessageComponent', () => {
  let component: FormMessageComponent;
  let fixture: ComponentFixture<FormMessageComponent>;
  let kristaFieldServiceSpy: jasmine.SpyObj<KristaFieldService>;
  let kristaFieldFactorySpy: jasmine.SpyObj<KristaFieldFactoryService>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let storageServiceSpy: jasmine.SpyObj<StorageService>;

  const createMockMessage = (overrides: Partial<KSDKMessage> = {}): KSDKMessage => {
    return {
      id: 'msg-123',
      messageType: MessageType.Ask,
      userMessage: 'Please fill the form',
      form: {
        readOnly: false,
        hideForm: false,
        pages: [{
          fields: [
            { fieldId: 'f1', name: 'textField', fieldType: 'com.krista.fields.Text', value: '', required: false },
            { fieldId: 'f2', name: 'emailField', fieldType: 'com.krista.fields.Email', value: '', required: true }
          ]
        }]
      },
      submit: undefined,
      ...overrides
    } as KSDKMessage;
  };

  const createMockKristaField = (): jasmine.SpyObj<KristaField> => {
    return jasmine.createSpyObj('KristaField', [
      'setValue', 'validate', 'markAsTouched', 'syncToFormField'
    ], {
      value: '',
      formattedValue: '',
      isValid: true,
      isTouched: false,
      errorMessage: ''
    });
  };

  // Builds a message containing a single MultiField (with two Text sub-fields).
  // `multiFieldValue` mimics what the backend sends for the parent field value.
  const createMultiFieldMessage = (multiFieldValue: any = ''): KSDKMessage => {
    return createMockMessage({
      form: {
        readOnly: false,
        hideForm: false,
        pages: [{
          fields: [
            {
              fieldId: 'mf1',
              name: 'multiField1',
              fieldType: 'com.krista.fields.MultiField',
              value: multiFieldValue,
              required: false,
              attributeValues: {
                fields: [
                  { name: 'Text1', fieldType: 'com.krista.fields.Text' },
                  { name: 'Text2', fieldType: 'com.krista.fields.Text' }
                ]
              }
            }
          ]
        }]
      }
    } as Partial<KSDKMessage>);
  };

  beforeEach(async () => {
    const kristaFieldSpy = jasmine.createSpyObj('KristaFieldService', ['getKristaValue', 'getFormattedValue']);
    const factorySpy = jasmine.createSpyObj('KristaFieldFactoryService', ['create']);
    const configSpy = jasmine.createSpyObj('ConfigService', ['getCurrentConfig']);
    const storageSpy = jasmine.createSpyObj('StorageService', ['getClientSessionId']);

    kristaFieldSpy.getKristaValue.and.callFake((field: any, value: any) => value);
    kristaFieldSpy.getFormattedValue.and.callFake((field: any, value: any) => value?.toString() || '');
    factorySpy.create.and.callFake(() => createMockKristaField());
    configSpy.getCurrentConfig.and.returnValue({ workspaceId: 'ws-123', config: {} });
    storageSpy.getClientSessionId.and.returnValue('session-123');

    await TestBed.configureTestingModule({
      declarations: [FormMessageComponent],
      providers: [
        { provide: KristaFieldService, useValue: kristaFieldSpy },
        { provide: KristaFieldFactoryService, useValue: factorySpy },
        { provide: ConfigService, useValue: configSpy },
        { provide: StorageService, useValue: storageSpy },
        ChangeDetectorRef,
        provideHttpClient(),
        provideHttpClientTesting()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(FormMessageComponent);
    component = fixture.componentInstance;
    kristaFieldServiceSpy = TestBed.inject(KristaFieldService) as jasmine.SpyObj<KristaFieldService>;
    kristaFieldFactorySpy = TestBed.inject(KristaFieldFactoryService) as jasmine.SpyObj<KristaFieldFactoryService>;
    configServiceSpy = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
    storageServiceSpy = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;

    component.message = createMockMessage();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should initialize form fields from message', () => {
      fixture.detectChanges();
      expect(component.formFields.length).toBe(2);
    });

    it('should create KristaField instances for each field', () => {
      fixture.detectChanges();
      expect(kristaFieldFactorySpy.create).toHaveBeenCalledTimes(2);
    });

    it('should store KristaField instances in map', () => {
      fixture.detectChanges();
      expect(component.kristaFields.size).toBe(2);
    });
  });

  describe('Input Properties', () => {
    it('should accept message input', () => {
      const message = createMockMessage({ id: 'custom-msg' });
      component.message = message;
      expect(component.message.id).toBe('custom-msg');
    });

    it('should accept errorFields input', () => {
      component.errorFields = ['field1', 'field2'];
      expect(component.errorFields).toEqual(['field1', 'field2']);
    });

    it('should accept errorMessages input', () => {
      component.errorMessages = ['Error 1', 'Error 2'];
      expect(component.errorMessages).toEqual(['Error 1', 'Error 2']);
    });

    it('should accept isWelcomeMessage input', () => {
      component.isWelcomeMessage = true;
      expect(component.isWelcomeMessage).toBeTrue();
    });
  });

  describe('messageText getter', () => {
    it('should return userMessage from message', () => {
      component.message = createMockMessage({ userMessage: 'Test message' });
      expect(component.messageText).toBe('Test message');
    });

    it('should return empty string when userMessage is undefined', () => {
      component.message = createMockMessage({ userMessage: undefined });
      expect(component.messageText).toBe('');
    });
  });

  describe('showForm getter', () => {
    it('should return true when form is not hidden and has fields', () => {
      fixture.detectChanges();
      expect(component.showForm).toBeTrue();
    });

    it('should return false when form is hidden', () => {
      component.message = createMockMessage({
        form: { hideForm: true, pages: [{ fields: [{ fieldId: 'f1', name: 'f1', fieldType: 'com.krista.fields.Text' }] }] }
      });
      fixture.detectChanges();
      expect(component.showForm).toBeFalse();
    });

    it('should return false when no fields', () => {
      component.message = createMockMessage({
        form: { hideForm: false, pages: [] }
      });
      fixture.detectChanges();
      expect(component.showForm).toBeFalse();
    });
  });

  describe('showSendButton getter', () => {
    it('should return true for editable form without paths', () => {
      fixture.detectChanges();
      expect(component.showSendButton).toBeTrue();
    });

    it('should return false when form is readOnly', () => {
      component.message = createMockMessage({
        form: { readOnly: true, pages: [{ fields: [{ fieldId: 'f1', name: 'f1', fieldType: 'com.krista.fields.Text' }] }] }
      });
      fixture.detectChanges();
      expect(component.showSendButton).toBeFalse();
    });

    it('should return false after successful submission', () => {
      fixture.detectChanges();
      component.isFormSubmittedSuccessfully = true;
      expect(component.showSendButton).toBeFalse();
    });
  });

  describe('isFieldReadOnly', () => {
    it('should return true when field is marked readOnly', () => {
      const field = { name: 'f1', readOnly: true } as FormField;
      expect(component.isFieldReadOnly(field)).toBeTrue();
    });

    it('should return true when form is readOnly', () => {
      component.message = createMockMessage({
        form: { readOnly: true, pages: [{ fields: [] }] }
      });
      const field = { name: 'f1', readOnly: false } as FormField;
      expect(component.isFieldReadOnly(field)).toBeTrue();
    });

    it('should return true when message type is not Ask', () => {
      component.message = createMockMessage({ messageType: MessageType.Inform });
      const field = { name: 'f1', readOnly: false } as FormField;
      expect(component.isFieldReadOnly(field)).toBeTrue();
    });

    it('should return true after form submission', () => {
      fixture.detectChanges();
      component.isFormSubmittedSuccessfully = true;
      const field = { name: 'f1', readOnly: false } as FormField;
      expect(component.isFieldReadOnly(field)).toBeTrue();
    });

    it('should return false for editable field in Ask message', () => {
      fixture.detectChanges();
      const field = { name: 'f1', readOnly: false } as FormField;
      expect(component.isFieldReadOnly(field)).toBeFalse();
    });
  });

  describe('isFieldRequired', () => {
    it('should return true when field is required', () => {
      const field = { name: 'f1', required: true } as FormField;
      expect(component.isFieldRequired(field)).toBeTrue();
    });

    it('should return false when field is not required', () => {
      const field = { name: 'f1', required: false } as FormField;
      expect(component.isFieldRequired(field)).toBeFalse();
    });
  });

  describe('Field Type Detection', () => {
    it('should identify text field', () => {
      const field = { fieldType: 'com.krista.fields.Text' } as FormField;
      expect(component.isTextField(field)).toBeTrue();
    });

    it('should identify email field as text field', () => {
      const field = { fieldType: 'com.krista.fields.Email' } as FormField;
      expect(component.isTextField(field)).toBeTrue();
    });

    it('should identify number field', () => {
      const field = { fieldType: 'com.krista.fields.Number' } as FormField;
      expect(component.isNumberField(field)).toBeTrue();
    });

    it('should identify currency field as number field', () => {
      const field = { fieldType: 'com.krista.fields.Currency' } as FormField;
      expect(component.isNumberField(field)).toBeTrue();
    });

    it('should identify date field', () => {
      const field = { fieldType: 'com.krista.fields.Date' } as FormField;
      expect(component.isDateField(field)).toBeTrue();
    });

    it('should identify time field', () => {
      const field = { fieldType: 'com.krista.fields.Time' } as FormField;
      expect(component.isTimeField(field)).toBeTrue();
    });

    it('should identify switch field', () => {
      const field = { fieldType: 'com.krista.fields.Switch' } as FormField;
      expect(component.isSwitchField(field)).toBeTrue();
    });

    it('should identify rating field', () => {
      const field = { fieldType: 'com.krista.fields.Rating' } as FormField;
      expect(component.isRatingField(field)).toBeTrue();
    });

    it('should identify pick one field', () => {
      const field = { fieldType: 'com.krista.fields.PickOne' } as FormField;
      expect(component.isPickOneField(field)).toBeTrue();
    });

    it('should identify checkboxes field', () => {
      const field = { fieldType: 'com.krista.fields.Checkboxes' } as FormField;
      expect(component.isCheckboxesField(field)).toBeTrue();
    });

    it('should identify file field', () => {
      const field = { fieldType: 'com.krista.fields.File' } as FormField;
      expect(component.isFileField(field)).toBeTrue();
    });

    it('should identify location field', () => {
      const field = { fieldType: 'com.krista.fields.Location' } as FormField;
      expect(component.isLocationField(field)).toBeTrue();
    });

    it('should identify address field', () => {
      const field = { fieldType: 'com.krista.fields.Address' } as FormField;
      expect(component.isAddressCompoundField(field)).toBeTrue();
    });
  });

  describe('onFieldValueChange', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should call KristaField setValue', () => {
      const mockKristaField = component.kristaFields.get('textField');
      component.onFieldValueChange('textField', 'new value');
      expect(mockKristaField?.setValue).toHaveBeenCalledWith('new value');
    });

    it('should sync formatted value back to FormField', () => {
      // Setup mock to return formatted value
      const mockKristaField = component.kristaFields.get('textField');
      if (mockKristaField) {
        Object.defineProperty(mockKristaField, 'value', { get: () => 'formatted value' });
      }
      component.onFieldValueChange('textField', 'new value');
      const field = component.formFields.find(f => f.name === 'textField');
      expect(field?.value).toBe('formatted value');
    });
  });

  describe('onSubmitForm', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should not submit when already submitting', () => {
      component.isSubmitting = true;
      spyOn(component.sendFormData, 'emit');
      component.onSubmitForm();
      expect(component.sendFormData.emit).not.toHaveBeenCalled();
    });

    it('should set hasAttemptedSubmit to true', () => {
      component.onSubmitForm();
      expect(component.hasAttemptedSubmit).toBeTrue();
    });

    it('should emit sendFormData on successful submission', () => {
      spyOn(component.sendFormData, 'emit');
      // Make all fields valid by setting up mock KristaFields
      component.kristaFields.forEach(kf => {
        kf.validate = jasmine.createSpy().and.returnValue(true);
        Object.defineProperty(kf, 'isValid', { get: () => true });
      });
      component.onSubmitForm();
      expect(component.sendFormData.emit).toHaveBeenCalled();
    });

    it('should set isFormSubmittedSuccessfully to true on success', () => {
      component.kristaFields.forEach(kf => {
        kf.validate = jasmine.createSpy().and.returnValue(true);
        Object.defineProperty(kf, 'isValid', { get: () => true });
      });
      component.onSubmitForm();
      expect(component.isFormSubmittedSuccessfully).toBeTrue();
    });
  });

  describe('getFieldWidthClass', () => {
    it('should return small for S visualWidth', () => {
      const field = { attributeValues: { visualWidth: 'S' } } as FormField;
      expect(component.getFieldWidthClass(field)).toBe('small');
    });

    it('should return medium for M visualWidth', () => {
      const field = { attributeValues: { visualWidth: 'M' } } as FormField;
      expect(component.getFieldWidthClass(field)).toBe('medium');
    });

    it('should return large for L visualWidth', () => {
      const field = { attributeValues: { visualWidth: 'L' } } as FormField;
      expect(component.getFieldWidthClass(field)).toBe('large');
    });

    it('should return large for Address field type', () => {
      const field = { fieldType: 'com.krista.fields.Address' } as FormField;
      expect(component.getFieldWidthClass(field)).toBe('large');
    });

    it('should return small as default', () => {
      const field = { fieldType: 'com.krista.fields.Text' } as FormField;
      expect(component.getFieldWidthClass(field)).toBe('small');
    });
  });

  describe('getWorkspaceId', () => {
    it('should return workspace ID from config', () => {
      expect(component.getWorkspaceId()).toBe('ws-123');
    });
  });

  describe('getClientSessionId', () => {
    it('should return client session ID from storage', () => {
      expect(component.getClientSessionId()).toBe('session-123');
    });
  });

  // Regression suite for KR-21024: a MultiField/Composite with no sub-field
  // selected was defaulting to '' (empty string). The backend deserializes the
  // MultiField answer into a java.util.Map, so a String value threw
  // "class java.lang.String cannot be cast to class java.util.Map" and marked
  // the conversation Incomplete. These tests pin the contract that a
  // MultiField/Composite value is ALWAYS an object, never a string.
  describe('getDefaultFieldValue - MultiField/Composite (KR-21024)', () => {
    const getDefault = (fieldType: string): any => {
      const field = { fieldType } as FormField;
      return (component as any).getDefaultFieldValue(field);
    };

    it('should return an empty object for MultiField', () => {
      expect(getDefault('com.krista.fields.MultiField')).toEqual({});
    });

    it('should return an empty object for Composite', () => {
      expect(getDefault('com.krista.fields.Composite')).toEqual({});
    });

    it('should default MultiField to a plain object, never a string', () => {
      const value = getDefault('com.krista.fields.MultiField');
      expect(typeof value).toBe('object');
      expect(typeof value).not.toBe('string');
      expect(value).not.toBe('');
      expect(value).not.toBeNull();
      expect(Array.isArray(value)).toBeFalse();
    });

    it('should default Composite to a plain object, never a string', () => {
      const value = getDefault('com.krista.fields.Composite');
      expect(typeof value).toBe('object');
      expect(value).not.toBe('');
      expect(Array.isArray(value)).toBeFalse();
    });

    it('should return a fresh object per call to avoid shared mutation across fields', () => {
      const a = getDefault('com.krista.fields.MultiField');
      const b = getDefault('com.krista.fields.MultiField');
      expect(a).not.toBe(b);
    });

    it('should not regress defaults for other field types', () => {
      expect(getDefault('com.krista.fields.Text')).toBe('');
      expect(getDefault('com.krista.fields.PickMany')).toEqual([]);
      expect(getDefault('com.krista.fields.Checkboxes')).toEqual([]);
      expect(getDefault('com.krista.fields.File')).toBeNull();
    });
  });

  describe('MultiField value initialization (KR-21024)', () => {
    it('should initialize an untouched MultiField value as an empty object', () => {
      component.message = createMultiFieldMessage('');
      fixture.detectChanges();
      const field = component.formFields.find(f => f.name === 'multiField1');
      expect(field?.value).toEqual({});
    });

    it('should never leave an untouched MultiField value as an empty string', () => {
      component.message = createMultiFieldMessage('');
      fixture.detectChanges();
      const field = component.formFields.find(f => f.name === 'multiField1');
      expect(field?.value).not.toBe('');
      expect(typeof field?.value).toBe('object');
    });

    it('should replace a null MultiField value with an empty object', () => {
      component.message = createMultiFieldMessage(null);
      fixture.detectChanges();
      const field = component.formFields.find(f => f.name === 'multiField1');
      expect(field?.value).toEqual({});
    });

    it('should preserve an existing object value coming from the backend', () => {
      component.message = createMultiFieldMessage({ Text1: 'prefilled' });
      fixture.detectChanges();
      const field = component.formFields.find(f => f.name === 'multiField1');
      expect(field?.value).toEqual({ Text1: 'prefilled' });
    });
  });

  describe('onMultiFieldSubFieldChange - partial fill (KR-21024)', () => {
    it('should keep the MultiField value as an object when a single sub-field is filled', () => {
      component.message = createMultiFieldMessage('');
      fixture.detectChanges();
      const parent = component.formFields.find(f => f.name === 'multiField1')!;
      expect(parent.value).toEqual({});

      component.onMultiFieldSubFieldChange(parent, 'multiField1.Text1', 'hello');

      expect(typeof parent.value).toBe('object');
      expect(parent.value).toEqual({ Text1: 'hello' });
    });

    it('should never produce a string value after a sub-field change', () => {
      component.message = createMultiFieldMessage('');
      fixture.detectChanges();
      const parent = component.formFields.find(f => f.name === 'multiField1')!;

      component.onMultiFieldSubFieldChange(parent, 'multiField1.Text1', 'hello');

      expect(typeof parent.value).not.toBe('string');
    });
  });

  describe('onSubmitForm - MultiField answer shape (KR-21024)', () => {
    it('should emit with the MultiField value still an object when none of its sub-fields are touched', () => {
      // Make every field (parent + lazily-created sub-fields) validate as valid
      kristaFieldFactorySpy.create.and.callFake(() => {
        const kf = createMockKristaField();
        (kf.validate as jasmine.Spy).and.returnValue(true);
        return kf;
      });
      component.message = createMultiFieldMessage('');
      fixture.detectChanges();
      spyOn(component.sendFormData, 'emit');

      component.onSubmitForm();

      expect(component.sendFormData.emit).toHaveBeenCalled();
      const field = component.formFields.find(f => f.name === 'multiField1');
      expect(typeof field?.value).toBe('object');
      expect(field?.value).toEqual({});
      expect(field?.value).not.toBe('');
    });
  });
});

