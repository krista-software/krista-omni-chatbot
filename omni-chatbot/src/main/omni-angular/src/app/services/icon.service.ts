import { Injectable } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class IconService {

  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.registerIcons();
  }

  private registerIcons(): void {
    // Register the send icon SVG
    const sendIconSvg = `
      <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.6 10.7391L14.4 4.95652L7.2 14.0435V18.1739L10.4 14.8696L16 19L20 0L0 6.6087L5.6 10.7391Z"/>
      </svg>
    `;

    this.matIconRegistry.addSvgIconLiteral(
      'send',
      this.domSanitizer.bypassSecurityTrustHtml(sendIconSvg)
    );
  }
}
