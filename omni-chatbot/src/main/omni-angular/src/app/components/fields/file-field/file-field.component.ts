import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { FileFieldConfig } from '../../../models/field-config.model';
import { MediaUploadService } from '../../../services/media-upload.service';
import { validateFile, getAcceptAttribute } from '../../../utils/file-validation.util';
import { createMediaUrlDownload } from '../../../utils/media-url.util';

/**
 * File field component with built-in file handling logic.
 * This component handles file upload, download, and display internally,
 * making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-file-field',
  templateUrl: './file-field.component.html',
  styleUrls: ['./file-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileFieldComponent {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: FileFieldConfig = {
    workspaceId: 'default',
    clientSessionId: '',
    hasError: false,
    errorMessage: '',
    readOnly: false
  };
  @Input() compact: boolean = false; // Compact mode for table cells

  // Event outputs
  @Output() valueChange = new EventEmitter<any>();

  // Upload state
  isUploading: boolean = false;
  uploadError: string = '';

  constructor(
    private mediaUploadService: MediaUploadService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Get file name from field value
   */
  get fileName(): string {
    if (this.field.value) {
      // Handle array format (File fields after upload)
      if (Array.isArray(this.field.value) && this.field.value.length > 0) {
        const firstFile = this.field.value[0];
        return firstFile.fileName || firstFile.name || '';
      }
      // Handle Camera field format (single object with 'filename' lowercase)
      if (this.field.value.filename) {
        return this.field.value.filename;
      }
      // Handle File object (from user upload)
      if (this.field.value.name) {
        return this.field.value.name;
      }
      // Handle string value (from API/WebSocket - file path or name)
      if (typeof this.field.value === 'string') {
        // Extract filename from path if it's a full path
        const fileName = this.field.value.split('/').pop() || this.field.value;
        return fileName;
      }
      // Handle object with fileName property (from API)
      if (this.field.value.fileName) {
        return this.field.value.fileName;
      }
    }
    return '';
  }

  /**
   * Get formatted file size
   */
  get fileSize(): string {
    if (this.field.value) {
      // Handle array format (File fields after upload)
      if (Array.isArray(this.field.value) && this.field.value.length > 0) {
        const firstFile = this.field.value[0];
        if (firstFile.length) {
          return this.formatFileSize(firstFile.length);
        }
      }
      // Handle Camera field format (single object with 'length')
      if (this.field.value.length && typeof this.field.value.length === 'number') {
        return this.formatFileSize(this.field.value.length);
      }
      // Handle File object (from user upload)
      if (this.field.value.size) {
        return this.formatFileSize(this.field.value.size);
      }
      // Handle object with fileSize property (from API)
      if (this.field.value.fileSize) {
        return this.formatFileSize(this.field.value.fileSize);
      }
      // Handle object with size property as string
      if (this.field.value.size && typeof this.field.value.size === 'string') {
        const sizeNum = parseInt(this.field.value.size, 10);
        if (!isNaN(sizeNum)) {
          return this.formatFileSize(sizeNum);
        }
      }
    }
    return '';
  }

  /**
   * Get accepted file types from field attributes
   * Uses the same logic as original app
   */
  get acceptedFileTypes(): string {
    const fileTypes = this.field.attributeValues?.['fileTypes'] || [];
    return getAcceptAttribute(fileTypes);
  }

  /**
   * Check if field has a file
   */
  get hasFile(): boolean {
    if (!this.field.value) return false;

    // Handle array format (File fields after upload)
    if (Array.isArray(this.field.value) && this.field.value.length > 0) {
      return !!(this.field.value[0].mediaId || this.field.value[0].fileName);
    }

    // Handle Camera field format (single object with 'filename' or 'mediaId')
    if (this.field.value.filename || this.field.value.mediaId) return true;

    // Handle File object (from user upload)
    if (this.field.value.name) return true;

    // Handle string value (from API/WebSocket - file path or name)
    if (typeof this.field.value === 'string' && this.field.value.trim() !== '') return true;

    // Handle object with fileName property (from API)
    if (this.field.value.fileName) return true;

    return false;
  }

  /**
   * Check if file can be downloaded
   */
  get canDownload(): boolean {
    if (!this.field.value) return false;

    // Handle array format (File fields after upload)
    if (Array.isArray(this.field.value) && this.field.value.length > 0) {
      const firstFile = this.field.value[0];
      return !!(firstFile.mediaId || firstFile.url || firstFile.downloadUrl || firstFile.path);
    }

    // Check if file has download URL or media ID
    if (typeof this.field.value === 'object') {
      return !!(this.field.value.mediaId || this.field.value.url || this.field.value.downloadUrl || this.field.value.path);
    }

    // For string values, assume it's a downloadable path
    if (typeof this.field.value === 'string') {
      return this.field.value.trim() !== '';
    }

    return false;
  }

  /**
   * Handle file selection with validation (matching original app)
   */
  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (!file) {
      this.valueChange.emit(null);
      return;
    }

    // Validate file using original app's validation logic
    const fileTypes = this.field.attributeValues?.['fileTypes'] || [];
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
      this.cdr.markForCheck();
      // Clear the file input
      event.target.value = '';
      return;
    }

    // Start upload
    this.isUploading = true;
    this.uploadError = '';

    this.mediaUploadService.uploadMedia(this.config.workspaceId, file, 'messages').subscribe({
      next: (response: any) => {
        // Process image to get dimensions and blur thumbnail
        this.processImage(file, response.mediaId);
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('FileFieldComponent.onFileChange() - Upload failed:', error);
        this.isUploading = false;
        this.uploadError = 'Failed to upload file. Please try again.';
        this.valueChange.emit(null);
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Process image to extract dimensions and generate blur thumbnail
   */
  private processImage(file: File, mediaId: string): void {
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      // Not an image, emit without image metadata
      this.emitFileMetadata(file, mediaId, null, null, null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const width = img.width;
        const height = img.height;

        // Generate blur thumbnail
        const blurImage = this.generateBlurThumbnail(img);

        // Emit file metadata with image info
        this.emitFileMetadata(file, mediaId, width, height, blurImage);
      };
      img.onerror = () => {
        console.error('FileFieldComponent.processImage() - Failed to load image');
        // Emit without image metadata
        this.emitFileMetadata(file, mediaId, null, null, null);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      console.error('FileFieldComponent.processImage() - Failed to read file');
      // Emit without image metadata
      this.emitFileMetadata(file, mediaId, null, null, null);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Generate blur thumbnail (40x40px) as base64 JPEG
   */
  private generateBlurThumbnail(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Set canvas size to 40x40 (matching original app)
    const thumbnailSize = 40;
    canvas.width = thumbnailSize;
    canvas.height = thumbnailSize;

    // Calculate aspect ratio
    const aspectRatio = img.width / img.height;
    let drawWidth = thumbnailSize;
    let drawHeight = thumbnailSize;
    let offsetX = 0;
    let offsetY = 0;

    if (aspectRatio > 1) {
      // Landscape
      drawHeight = thumbnailSize / aspectRatio;
      offsetY = (thumbnailSize - drawHeight) / 2;
    } else {
      // Portrait
      drawWidth = thumbnailSize * aspectRatio;
      offsetX = (thumbnailSize - drawWidth) / 2;
    }

    // Draw image on canvas
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // Convert to base64 JPEG (quality 0.7 matching original app)
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  /**
   * Emit file metadata with or without image info
   */
  private emitFileMetadata(file: File, mediaId: string, width: number | null, height: number | null, blurImage: string | null): void {
    const isCameraField = this.field.fieldType === 'com.krista.fields.Camera';

    if (isCameraField) {
      // Camera field: emit single object with lowercase 'filename'
      const cameraMetadata: any = {
        mediaId: mediaId,
        filename: file.name,  // lowercase 'filename'
        length: file.size
      };

      // Add image metadata if available
      if (width !== null && height !== null) {
        cameraMetadata.width = width;
        cameraMetadata.height = height;
      }
      if (blurImage) {
        cameraMetadata.blurImageStr = blurImage;
      }

      this.valueChange.emit(cameraMetadata);
    } else {
      // File field: emit array format
      const fileMetadata: any = {
        fileName: file.name,
        mediaId: mediaId,
        length: file.size,
        extension: file.name.split('.').pop() || ''
      };

      // Add image metadata if available
      if (width !== null && height !== null) {
        fileMetadata.width = width;
        fileMetadata.height = height;
      }
      if (blurImage) {
        fileMetadata.blurImage = blurImage;
      }

      this.valueChange.emit([fileMetadata]);
    }

    // Clear uploading state
    this.isUploading = false;
    this.cdr.markForCheck();
  }

  /**
   * Handle file removal
   */
  removeFile(): void {
    this.valueChange.emit(null);
    // Clear the file input
    const fileInput = document.querySelector(`input[type="file"][name="${this.field.name}"]`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Handle file download
   */
  downloadFile(): void {
    if (!this.field.value) return;

    let downloadUrl = '';
    let fileObject: any = null;

    // Handle array format (File fields store values as arrays)
    if (Array.isArray(this.field.value) && this.field.value.length > 0) {
      fileObject = this.field.value[0]; // Get first file from array
    }
    // Handle single object (Camera fields or direct object)
    else if (typeof this.field.value === 'object') {
      fileObject = this.field.value;
    }
    // Handle string value (direct URL or path)
    else if (typeof this.field.value === 'string') {
      downloadUrl = this.field.value;
    }

    // Extract download URL from file object
    if (fileObject) {
      if (fileObject.mediaId) {
        downloadUrl = createMediaUrlDownload(this.config.workspaceId, fileObject.mediaId);
      } else if (fileObject.url) {
        downloadUrl = fileObject.url;
      } else if (fileObject.downloadUrl) {
        downloadUrl = fileObject.downloadUrl;
      } else if (fileObject.path) {
        downloadUrl = fileObject.path;
      }
    }

    if (downloadUrl) {
      // Open file in new tab (matches original app behavior)
      window.open(downloadUrl, '_blank');
    }
  }

  /**
   * Format file size in bytes to human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  /**
   * Check if field is read-only
   */
  isFieldReadOnly(): boolean {
    return this.config?.readOnly || this.field.readOnly || false;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config?.showLabel !== false; // Show by default unless explicitly set to false
  }
}
