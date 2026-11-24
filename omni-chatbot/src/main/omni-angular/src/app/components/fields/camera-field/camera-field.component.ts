import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { FieldValidation, VALIDATION_MESSAGES } from '../../../interfaces/field-validation.interface';
import { KristaFieldService } from '../../../services/krista-field.service';
import { MediaUploadService } from '../../../services/media-upload.service';
import { validateFile, BLOCKED_FILE_EXTENSIONS } from '../../../utils/file-validation.util';
import { createMediaUrlDownload } from '../../../utils/media-url.util';

/**
 * Self-contained camera field component.
 * This component handles image file selection, validation, preview generation,
 * and file size formatting internally, making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-camera-field',
  templateUrl: './camera-field.component.html',
  styleUrls: ['./camera-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class CameraFieldComponent implements FieldValidation {
  @Input() field!: FormField;
  @Input() hasError: boolean = false;
  @Input() errorMessage: string = '';
  @Input() readOnly: boolean = false;
  @Input() config: any; // Add config input for workspaceId
  @Output() valueChange = new EventEmitter<any>();

  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  selectedFiles: File[] = [];
  previewUrls: string[] = [];
  isUploading: boolean = false;
  uploadError: string = '';

  constructor(
    private kristaFieldService: KristaFieldService,
    private mediaUploadService: MediaUploadService
  ) {}

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file) {
      this.valueChange.emit(null);
      return;
    }

    // Validate file using original app's validation logic
    // Camera field only accepts images
    const fileTypes = ['CameraImageOnly'];
    const excludedExtensions = this.field.attributeValues?.['excludedFileExtensions'] || [];

    // Convert file sizes from configured units to bytes (matching original app logic)
    const fileSizeMultipliers: { [key: string]: number } = {
      'kb': 1024,
      'mb': 1024 * 1024
    };

    let minFileSize: number | undefined;
    let maxFileSize: number | undefined;

    const minFileSizeValue = this.field.attributeValues?.['minFileSize'];
    const minFileSizeUnit = this.field.attributeValues?.['minFileSizeUnit'];
    if (minFileSizeValue && !isNaN(+minFileSizeValue) && minFileSizeUnit) {
      const multiplier = fileSizeMultipliers[minFileSizeUnit.toLowerCase()];
      if (multiplier) {
        minFileSize = +minFileSizeValue * multiplier;
      }
    }

    const maxFileSizeValue = this.field.attributeValues?.['maxFileSize'];
    const maxFileSizeUnit = this.field.attributeValues?.['maxFileSizeUnit'];
    if (maxFileSizeValue && !isNaN(+maxFileSizeValue) && maxFileSizeUnit) {
      const multiplier = fileSizeMultipliers[maxFileSizeUnit.toLowerCase()];
      if (multiplier) {
        maxFileSize = +maxFileSizeValue * multiplier;
      }
    }

    const validationError = validateFile(file, fileTypes, excludedExtensions, minFileSize, maxFileSize);

    if (validationError) {
      this.uploadError = validationError;
      this.valueChange.emit(null);
      // Clear the input
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
      return;
    }

    this.isUploading = true;
    this.uploadError = '';

    // Upload file to server
    this.mediaUploadService.uploadMedia(this.config.workspaceId, file, 'messages').subscribe({
      next: (response) => {
        this.isUploading = false;

        // Camera fields send a SINGLE OBJECT (not array) with lowercase 'filename' (matches original app)
        const cameraMetadata = {
          mediaId: response.mediaId,
          filename: file.name,  // lowercase 'filename' for camera fields
          length: file.size
          // Note: width, height, blurImageStr would be added here if we had image processing
        };

        // Emit as single object (not array) to match original app format
        this.valueChange.emit(cameraMetadata);
      },
      error: (error) => {
        console.error('CameraFieldComponent.onFileSelect() - Upload failed:', error);
        this.isUploading = false;
        this.uploadError = 'Failed to upload file. Please try again.';
        this.valueChange.emit(null);
      }
    });

    // Clear the input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  removeFile(index: number): void {
    // Camera field only supports single file, so just clear it
    this.valueChange.emit(null);
  }

  /**
   * Download file in read-only mode (matches original app behavior)
   */
  downloadFile(): void {
    if (!this.field.value) return;

    let downloadUrl = '';

    // Handle object with media ID (matches original app logic)
    if (typeof this.field.value === 'object' && this.field.value.mediaId) {
      downloadUrl = createMediaUrlDownload(this.config.workspaceId, this.field.value.mediaId);
    }

    if (downloadUrl) {
      // Open file in new tab (matches original app behavior)
      window.open(downloadUrl, '_blank');
    }
  }

  /**
   * Check if file can be downloaded
   */
  canDownload(): boolean {
    if (!this.field.value) return false;

    // Check if we have a mediaId to download
    if (typeof this.field.value === 'object' && this.field.value.mediaId) {
      return true;
    }

    return false;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  isFieldReadOnly(): boolean {
    return this.readOnly || this.field.readOnly || false;
  }

  getAcceptedTypes(): string {
    return 'image/*'; // Camera field accepts all image types
  }

  getPlaceholder(): string {
    if (this.isFieldReadOnly()) return '';
    return 'Select image files...';
  }

  // FieldValidation interface implementation
  validateField(): string | null {
    const { isValid, errorMessage } = this.kristaFieldService.validateField(this.field as any, this.field?.value);
    return isValid ? null : (errorMessage || VALIDATION_MESSAGES.enterCorrectValues);
  }

  isFieldEmpty(): boolean {
    return this.selectedFiles.length === 0;
  }

  getFormattedReadOnlyValue(): string {
    if (this.isFieldEmpty()) return 'No images selected';

    if (this.selectedFiles.length === 1) {
      return `1 image selected: ${this.selectedFiles[0].name}`;
    }

    return `${this.selectedFiles.length} images selected`;
  }

  triggerFileInput(): void {
    if (!this.isFieldReadOnly() && this.fileInput) {
      this.fileInput.nativeElement.click();
    }
  }
}
