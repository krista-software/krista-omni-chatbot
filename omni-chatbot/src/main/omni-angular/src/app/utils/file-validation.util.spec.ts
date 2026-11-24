import { validateFile, isFileTypeValid, getAcceptAttribute, formatFileSize, BLOCKED_FILE_EXTENSIONS } from './file-validation.util';

describe('File Validation Utility', () => {
  describe('validateFile', () => {
    it('should accept valid image file for CameraImageOnly', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const result = validateFile(file, ['CameraImageOnly']);
      expect(result).toBe('');
    });

    it('should reject blocked extension', () => {
      const file = new File([''], 'malware.exe', { type: 'application/x-msdownload' });
      const result = validateFile(file, ['Document']);
      expect(result).toContain('not supported');
    });

    it('should reject file exceeding max size', () => {
      const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      const result = validateFile(file, ['CameraImageOnly'], [], undefined, 10 * 1024 * 1024);
      expect(result).toContain('too large');
    });

    it('should accept file within size limits', () => {
      const file = new File(['x'.repeat(5 * 1024 * 1024)], 'medium.jpg', { type: 'image/jpeg' });
      const result = validateFile(file, ['CameraImageOnly'], [], undefined, 10 * 1024 * 1024);
      expect(result).toBe('');
    });

    it('should reject excluded extension', () => {
      const file = new File([''], 'test.svg', { type: 'image/svg+xml' });
      const result = validateFile(file, ['CameraImageOnly'], ['svg']);
      expect(result).toContain('not supported');
    });
  });

  describe('isFileTypeValid', () => {
    it('should accept any file type for Document', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(isFileTypeValid(file, ['Document'])).toBe(true);
    });

    it('should accept image for CameraImageOnly', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      expect(isFileTypeValid(file, ['CameraImageOnly'])).toBe(true);
    });

    it('should reject video for CameraImageOnly', () => {
      const file = new File([''], 'test.mp4', { type: 'video/mp4' });
      expect(isFileTypeValid(file, ['CameraImageOnly'])).toBe(false);
    });

    it('should accept both image and video for Camera', () => {
      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const videoFile = new File([''], 'test.mp4', { type: 'video/mp4' });
      expect(isFileTypeValid(imageFile, ['Camera'])).toBe(true);
      expect(isFileTypeValid(videoFile, ['Camera'])).toBe(true);
    });

    it('should accept CSV for Contact', () => {
      const file = new File([''], 'contacts.csv', { type: 'text/csv' });
      expect(isFileTypeValid(file, ['Contact'])).toBe(true);
    });

    it('should accept VCF for Contact', () => {
      const file = new File([''], 'contacts.vcf', { type: 'text/vcard' });
      expect(isFileTypeValid(file, ['Contact'])).toBe(true);
    });
  });

  describe('getAcceptAttribute', () => {
    it('should return */* for Document', () => {
      expect(getAcceptAttribute(['Document'])).toBe('*/*');
    });

    it('should return image/* for CameraImageOnly', () => {
      expect(getAcceptAttribute(['CameraImageOnly'])).toBe('image/*');
    });

    it('should return image/*,video/* for Camera', () => {
      expect(getAcceptAttribute(['Camera'])).toBe('image/*,video/*');
    });

    it('should return .csv,.vcf for Contact', () => {
      expect(getAcceptAttribute(['Contact'])).toBe('.csv,.vcf');
    });

    it('should return audio/* for Audio', () => {
      expect(getAcceptAttribute(['Audio'])).toBe('audio/*');
    });

    it('should return */* for empty array', () => {
      expect(getAcceptAttribute([])).toBe('*/*');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('BLOCKED_FILE_EXTENSIONS', () => {
    it('should include common dangerous extensions', () => {
      expect(BLOCKED_FILE_EXTENSIONS).toContain('exe');
      expect(BLOCKED_FILE_EXTENSIONS).toContain('bat');
      expect(BLOCKED_FILE_EXTENSIONS).toContain('js');
      expect(BLOCKED_FILE_EXTENSIONS).toContain('jar');
      expect(BLOCKED_FILE_EXTENSIONS).toContain('svg');
      expect(BLOCKED_FILE_EXTENSIONS).toContain('html');
    });
  });
});

