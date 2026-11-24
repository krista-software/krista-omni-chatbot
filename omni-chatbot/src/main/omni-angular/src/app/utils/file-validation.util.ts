/**
 * File validation utilities matching original app's file handling
 * (originally ported from the React chatbot)
 */

/**
 * Blocked file extensions for security (matching original app)
 */
export const BLOCKED_FILE_EXTENSIONS = [
  'ace', 'ade', 'adp', 'ani', 'app', 'appcontent-ms', 'appref-ms', 'asp', 'aspx', 'asx',
  'bas', 'bat', 'cdxml', 'cer', 'chm', 'cmd', 'cnt', 'com', 'cpl', 'crt', 'csh', 'der',
  'diagcab', 'docm', 'exe', 'fxp', 'gadget', 'grp', 'hlp', 'hpj', 'hta', 'htc', 'inf',
  'ins', 'isp', 'its', 'jar', 'jnlp', 'js', 'jse', 'ksh', 'lnk', 'mad', 'maf', 'mag',
  'mam', 'maq', 'mar', 'mas', 'mat', 'mau', 'mav', 'maw', 'mcf', 'mda', 'mdb', 'mde',
  'mdt', 'mdw', 'mdz', 'mht', 'mhtml', 'msc', 'msh', 'msh1', 'msh1xml', 'msh2', 'msh2xml',
  'mshxml', 'msi', 'msp', 'mst', 'msu', 'ops', 'osd', 'pcd', 'pif', 'pl', 'plg', 'prf',
  'prg', 'printerexport', 'ps1', 'ps1.xml', 'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2',
  'psd1', 'psdm1', 'psdm1cdxml', 'pssc', 'pst', 'py', 'pyc', 'pyo', 'pyw', 'pyz', 'pyzw',
  'reg', 'scf', 'scr', 'sct', 'settingcontent-ms', 'shb', 'shs', 'theme', 'tmp', 'udl',
  'url', 'vb', 'vbe', 'vbp', 'vbs', 'vsmacros', 'vss', 'vst', 'vsw', 'webpnp', 'website',
  'ws', 'wsb', 'wsc', 'wsf', 'wsh', 'xbap', 'xll', 'xml', 'xnk', 'svg', 'html', 'php5',
  'pht', 'phtml', 'shtml', 'asa', 'asax', 'swf', 'xap', 'jsp'
];

/**
 * File format mappings (matching original app)
 */
export const FILE_FORMATS: { [key: string]: string } = {
  'Document': '*/*',
  'Image gallery': 'image/*,video/*',
  'CameraImageOnly': 'image/*',
  'Camera': 'image/*,video/*',
  'Contact': '.csv,.vcf',
  'Audio': 'audio/*'
};

/**
 * File type prefixes for validation
 */
export const FILE_TYPE_PREFIXES: { [key: string]: string[] } = {
  'Image gallery': ['image/', 'video/'],
  'CameraImageOnly': ['image/'],
  'Camera': ['image/', 'video/'],
  'Audio': ['audio/']
};

/**
 * Validate if a file is allowed based on type, extension, and size
 * @param file - The file to validate
 * @param fileTypes - Array of allowed file types (e.g., ['Document', 'Image gallery'])
 * @param excludedExtensions - Array of excluded file extensions
 * @param minFileSize - Minimum file size in bytes
 * @param maxFileSize - Maximum file size in bytes
 * @returns Error message if validation fails, empty string if valid
 */
export function validateFile(
  file: File,
  fileTypes: string[] = [],
  excludedExtensions: string[] = [],
  minFileSize?: number,
  maxFileSize?: number
): string {
  if (!file.name) {
    return 'Unknown file format';
  }

  // Get file extension
  let ext = file.name.split('.').pop();
  ext = ext ? ext.toLowerCase() : '';

  if (!ext) {
    return `File "${file.name}" has unknown format`;
  }

  // Check if extension is blocked
  if (BLOCKED_FILE_EXTENSIONS.includes(ext)) {
    return `File "${file.name}" is not supported (blocked extension)`;
  }

  // Check if extension is excluded
  if (excludedExtensions.includes('.' + ext) || excludedExtensions.includes(ext)) {
    return `File "${file.name}" is not supported (excluded extension)`;
  }

  // Validate file type
  if (!isFileTypeValid(file, fileTypes)) {
    return `File "${file.name}" type is not supported`;
  }

  // Validate minimum file size
  if (minFileSize && file.size < minFileSize) {
    return `File "${file.name}" is too small. Minimum size is ${formatFileSize(minFileSize)}`;
  }

  // Validate maximum file size
  if (maxFileSize && file.size > maxFileSize) {
    return `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}`;
  }

  return ''; // Valid
}

/**
 * Check if file type is valid based on allowed file types
 */
export function isFileTypeValid(file: File, fileTypes: string[]): boolean {
  // If no file types specified or 'Document' is included, allow all
  if (fileTypes.length === 0 || fileTypes.includes('Document')) {
    return true;
  }

  // Special handling for Contact files
  if (fileTypes.includes('Contact')) {
    let ext = file.name.split('.').pop();
    ext = ext ? ext.toLowerCase() : '';
    if (ext === 'csv' || ext === 'vcf') {
      return true;
    }
  }

  // Check file type prefixes
  const allowedPrefixes: string[] = [];
  fileTypes.forEach(ft => {
    const prefixes = FILE_TYPE_PREFIXES[ft];
    if (prefixes) {
      allowedPrefixes.push(...prefixes);
    }
  });

  // Check if file MIME type starts with any allowed prefix
  return allowedPrefixes.some(prefix => file.type.startsWith(prefix));
}

/**
 * Get accept attribute value for file input based on file types
 */
export function getAcceptAttribute(fileTypes: string[]): string {
  if (fileTypes.length === 0) {
    return '*/*';
  }

  if (fileTypes.includes('Document')) {
    return FILE_FORMATS['Document'];
  }

  const acceptTypes = fileTypes
    .map(type => FILE_FORMATS[type])
    .filter(Boolean);

  return acceptTypes.join(',') || '*/*';
}

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const digitGroups = Math.floor(Math.log10(bytes) / Math.log10(1024));
  return (bytes / Math.pow(1024, digitGroups)).toFixed(2) + ' ' + units[digitGroups];
}

