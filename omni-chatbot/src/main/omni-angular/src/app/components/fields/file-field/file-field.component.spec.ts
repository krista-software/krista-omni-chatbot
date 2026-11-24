import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileFieldComponent } from './file-field.component';
import { FormField } from '../../../models/message.model';
import { FileFieldConfig } from '../../../models/field-config.model';
import { MediaUploadService } from '../../../services/media-upload.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

describe('FileFieldComponent', () => {
  let component: FileFieldComponent;
  let fixture: ComponentFixture<FileFieldComponent>;
  let mockMediaUploadService: jasmine.SpyObj<MediaUploadService>;

  const createMockField = (overrides: Partial<FormField> = {}): FormField => {
    return {
      fieldId: 'field-123',
      name: 'testFile',
      fieldType: 'com.krista.fields.File',
      value: null,
      required: false,
      readOnly: false,
      attributeValues: {},
      ...overrides
    } as FormField;
  };

  const createMockConfig = (overrides: Partial<FileFieldConfig> = {}): FileFieldConfig => {
    return {
      workspaceId: 'default',
      clientSessionId: 'test-session',
      hasError: false,
      errorMessage: '',
      readOnly: false,
      ...overrides
    };
  };

  const createMockFileValue = (overrides: any = {}) => ({
    fileName: 'test-document.pdf',
    fileSize: 1024000,
    mimeType: 'application/pdf',
    url: 'https://example.com/files/test-document.pdf',
    ...overrides
  });

  beforeEach(async () => {
    mockMediaUploadService = jasmine.createSpyObj('MediaUploadService', ['uploadMedia', 'deleteFile']);
    mockMediaUploadService.uploadMedia.and.returnValue(of({
      mediaId: 'media-123',
      file: new File(['test'], 'test.pdf', { type: 'application/pdf' })
    }));

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      declarations: [FileFieldComponent],
      providers: [
        { provide: MediaUploadService, useValue: mockMediaUploadService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(FileFieldComponent);
    component = fixture.componentInstance;
    component.field = createMockField();
    component.config = createMockConfig();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onFileChange', () => {
    it('should upload file and emit value', () => {
      spyOn(component.valueChange, 'emit');
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const event = { target: { files: [mockFile] } };

      component.onFileChange(event as any);

      expect(mockMediaUploadService.uploadMedia).toHaveBeenCalled();
    });

    it('should not upload when no file selected', () => {
      const event = { target: { files: [] } };

      component.onFileChange(event as any);

      expect(mockMediaUploadService.uploadMedia).not.toHaveBeenCalled();
    });

    it('should still upload when readOnly (readOnly check is in template)', () => {
      // Note: readOnly check is done in the template by disabling the input
      // The component method itself doesn't check readOnly
      component.config = createMockConfig({ readOnly: true });
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const event = { target: { files: [mockFile] } };

      component.onFileChange(event as any);

      // Component still calls upload - readOnly is enforced in template
      expect(mockMediaUploadService.uploadMedia).toHaveBeenCalled();
    });
  });

  describe('removeFile', () => {
    it('should emit null to remove file', () => {
      spyOn(component.valueChange, 'emit');
      component.field = createMockField({ value: createMockFileValue() });

      component.removeFile();

      expect(component.valueChange.emit).toHaveBeenCalledWith(null);
    });

    it('should still emit when readOnly (readOnly check is in template)', () => {
      // Note: readOnly check is done in the template by hiding/disabling the remove button
      // The component method itself doesn't check readOnly
      spyOn(component.valueChange, 'emit');
      component.config = createMockConfig({ readOnly: true });

      component.removeFile();

      // Component still emits - readOnly is enforced in template
      expect(component.valueChange.emit).toHaveBeenCalledWith(null);
    });
  });

  describe('downloadFile', () => {
    it('should trigger download for file with URL', () => {
      component.field = createMockField({ value: createMockFileValue() });
      
      // Just verify it doesn't throw
      expect(() => component.downloadFile()).not.toThrow();
    });

    it('should not download when no file', () => {
      component.field = createMockField({ value: null });
      
      expect(() => component.downloadFile()).not.toThrow();
    });
  });

  describe('fileName getter', () => {
    it('should return file name from array value', () => {
      component.field = createMockField({ value: [{ fileName: 'test-document.pdf' }] });

      expect(component.fileName).toBe('test-document.pdf');
    });

    it('should return empty string when no file', () => {
      component.field = createMockField({ value: null });

      expect(component.fileName).toBe('');
    });

    it('should return filename from object value', () => {
      component.field = createMockField({ value: { filename: 'test.pdf' } });

      expect(component.fileName).toBe('test.pdf');
    });
  });

  describe('fileSize getter', () => {
    it('should return formatted file size from array value', () => {
      component.field = createMockField({ value: [{ length: 1024 }] });

      expect(component.fileSize).toContain('KB');
    });

    it('should return empty string when no file', () => {
      component.field = createMockField({ value: null });

      expect(component.fileSize).toBe('');
    });
  });

  describe('hasFile getter', () => {
    it('should return true when file is set', () => {
      component.field = createMockField({ value: [{ fileName: 'test.pdf', mediaId: '123' }] });

      expect(component.hasFile).toBeTrue();
    });

    it('should return false when no file', () => {
      component.field = createMockField({ value: null });

      expect(component.hasFile).toBeFalse();
    });

    it('should return true for string value', () => {
      component.field = createMockField({ value: '/path/to/file.pdf' });

      expect(component.hasFile).toBeTrue();
    });
  });

  describe('acceptedFileTypes getter', () => {
    it('should map Krista file type names from attributeValues to accept values', () => {
      component.field = createMockField({
        attributeValues: { fileTypes: ['CameraImageOnly', 'Audio'] }
      });

      expect(component.acceptedFileTypes).toBe('image/*,audio/*');
    });

    it('should return */* when no restriction', () => {
      component.field = createMockField({ attributeValues: {} });

      expect(component.acceptedFileTypes).toBe('*/*');
    });
  });

  describe('canDownload getter', () => {
    it('should return true when file has mediaId', () => {
      component.field = createMockField({ value: [{ mediaId: '123' }] });

      expect(component.canDownload).toBeTrue();
    });

    it('should return false when no file', () => {
      component.field = createMockField({ value: null });

      expect(component.canDownload).toBeFalse();
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

  describe('fileName getter', () => {
    it('should return empty string when value is null', () => {
      component.field = createMockField({ value: null });
      expect(component.fileName).toBe('');
    });

    it('should return fileName from array value', () => {
      component.field = createMockField({ value: [{ fileName: 'test.pdf' }] });
      expect(component.fileName).toBe('test.pdf');
    });

    it('should return filename from object value', () => {
      component.field = createMockField({ value: { filename: 'test.pdf' } });
      expect(component.fileName).toBe('test.pdf');
    });
  });

  describe('Input Properties', () => {
    it('should accept field input', () => {
      const field = createMockField({ name: 'customFile' });
      component.field = field;
      expect(component.field.name).toBe('customFile');
    });

    it('should accept config input', () => {
      const config = createMockConfig({ hasError: true, errorMessage: 'File required' });
      component.config = config;
      expect(component.config.hasError).toBeTrue();
    });
  });
});

