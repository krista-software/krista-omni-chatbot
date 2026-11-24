import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getSanitizedMarkup } from '../utils/html-sanitizer.util';
import { StorageService } from '../services/storage.service';

@Pipe({
  name: 'safeHtml',
  standalone: false
})
export class SafeHtmlPipe implements PipeTransform {

  constructor(
    private sanitizer: DomSanitizer,
    private storageService: StorageService
  ) {}

  transform(value: string): SafeHtml {
    if (!value) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    // Transform HTML to add src to images with data-mediaid and handle links
    // Uses window.workspaceId (set by ConfigService) - matches original app
    const transformedHtml = getSanitizedMarkup(value, this.storageService);

    // Bypass sanitization to allow custom elements like krista-button, krista-link
    return this.sanitizer.bypassSecurityTrustHtml(transformedHtml);
  }
}
