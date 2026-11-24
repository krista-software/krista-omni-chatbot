import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CameraFieldComponent } from './camera-field.component';
import { FormField } from '../../../models/message.model';
import { MediaUploadService } from '../../../services/media-upload.service';
import { KristaFieldService } from '../../../services/krista-field.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

describe('CameraFieldComponent', () => {
  let component: CameraFieldComponent;
  let fixture: ComponentFixture<CameraFieldComponent>;
  let mockMediaUploadService: jasmine.SpyObj<MediaUploadService>;
  let mockKristaFieldService: jasmine.SpyObj<KristaFieldService>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testCamera',
      fieldType: 'com.krista.fields.Camera',
      value: null,
      label: 'Test Camera',
      required: false,
      readOnly: false,
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  const createMockImageValue = (overrides: any = {}) => ({
    mediaId: 'media-123',
    filename: 'photo.jpg',
    length: 512000,
    ...overrides
  });

  beforeEach(async () => {
    mockMediaUploadService = jasmine.createSpyObj('MediaUploadService', ['uploadMedia']);
    mockMediaUploadService.uploadMedia.and.returnValue(of({
      mediaId: 'media-123',
      file: new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
    }));

    mockKristaFieldService = jasmine.createSpyObj('KristaFieldService', ['validateField']);
    mockKristaFieldService.validateField.and.returnValue({ isValid: true, errorMessage: '' });

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [CameraFieldComponent],
      providers: [
        { provide: MediaUploadService, useValue: mockMediaUploadService },
        { provide: KristaFieldService, useValue: mockKristaFieldService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CameraFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = { workspaceId: 'test-workspace' };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onFileSelect', () => {
    it('should upload image file and emit value', () => {
      spyOn(component.valueChange, 'emit');
      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      const event = { target: { files: [mockFile] } };

      component.onFileSelect(event as any);

      expect(mockMediaUploadService.uploadMedia).toHaveBeenCalled();
    });

    it('should emit null when no file selected', () => {
      spyOn(component.valueChange, 'emit');
      const event = { target: { files: [] } };

      component.onFileSelect(event as any);

      expect(component.valueChange.emit).toHaveBeenCalledWith(null);
    });

    it('should reject non-image files', () => {
      spyOn(window, 'alert');
      const mockFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });
      const event = { target: { files: [mockFile] } };

      component.onFileSelect(event as any);

      expect(mockMediaUploadService.uploadMedia).not.toHaveBeenCalled();
    });
  });

  describe('removeFile', () => {
    it('should emit null to remove image', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: createMockImageValue() });

      component.removeFile(0);

      expect(component.valueChange.emit).toHaveBeenCalledWith(null);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(component.formatFileSize(500)).toContain('500');
      expect(component.formatFileSize(500)).toContain('Bytes');
    });

    it('should format KB correctly', () => {
      expect(component.formatFileSize(1024)).toContain('KB');
    });

    it('should format MB correctly', () => {
      expect(component.formatFileSize(1048576)).toContain('MB');
    });

    it('should handle 0 bytes', () => {
      expect(component.formatFileSize(0)).toBe('0 Bytes');
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
    it('should return true when readOnly input is true', () => {
      component.readOnly = true;
      expect(component.isFieldReadOnly()).toBeTrue();
    });

    it('should return true when field readOnly is true', () => {
      component.field = createMockField({ readOnly: true });
      expect(component.isFieldReadOnly()).toBeTrue();
    });

    it('should return false when both are false', () => {
      component.readOnly = false;
      component.field = createMockField({ readOnly: false });
      expect(component.isFieldReadOnly()).toBeFalse();
    });
  });

  describe('validateField', () => {
    it('should return null when field is valid', () => {
      component.field = createMockField({ value: createMockImageValue() });
      expect(component.validateField()).toBeNull();
    });

    it('should return error when validation fails', () => {
      mockKristaFieldService.validateField.and.returnValue({ isValid: false, errorMessage: 'Required' });
      component.field = createMockField({ required: true, value: null });
      expect(component.validateField()).toBeTruthy();
    });
  });

  describe('isFieldEmpty', () => {
    it('should return true when selectedFiles is empty', () => {
      component.selectedFiles = [];
      expect(component.isFieldEmpty()).toBeTrue();
    });

    it('should return false when selectedFiles has items', () => {
      component.selectedFiles = [new File(['test'], 'photo.jpg', { type: 'image/jpeg' })];
      expect(component.isFieldEmpty()).toBeFalse();
    });
  });

  describe('getAcceptedTypes', () => {
    it('should accept all image types', () => {
      expect(component.getAcceptedTypes()).toBe('image/*');
    });
  });

  describe('getPlaceholder', () => {
    it('should return placeholder text when not readonly', () => {
      component.readOnly = false;
      expect(component.getPlaceholder()).toBe('Select image files...');
    });

    it('should return empty string when readonly', () => {
      component.readOnly = true;
      expect(component.getPlaceholder()).toBe('');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customCamera' });
      component.field = field;
      expect(component.field.name).toBe('customCamera');
    });

    it('should accept hasError input', () => {
      component.hasError = true;
      expect(component.hasError).toBeTrue();
    });

    it('should accept errorMessage input', () => {
      component.errorMessage = 'Image required';
      expect(component.errorMessage).toBe('Image required');
    });
  });
});

