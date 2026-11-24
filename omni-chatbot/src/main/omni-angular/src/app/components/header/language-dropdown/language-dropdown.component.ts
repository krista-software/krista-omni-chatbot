import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ChangeDetectionStrategy, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Language {
  code: string;
  name: string;
  flag?: string;
}

/**
 * Lightweight language dropdown component
 * Replaces Angular Material's mat-select for better performance
 * Matches original app's MUI Select behavior (Header.tsx lines 101-110)
 */
@Component({
  selector: 'app-language-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-dropdown.component.html',
  styleUrls: ['./language-dropdown.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageDropdownComponent implements OnInit, OnChanges {
  @Input() languages: Language[] = [];
  @Input() selectedLanguage: string = 'en';
  @Output() languageChange = new EventEmitter<string>();

  isOpen = false;
  private selectedLanguageName: string = 'English';

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    // Initialize selected language name cache
    this.updateSelectedLanguageName();
  }

  ngOnChanges(): void {
    // Cache the selected language name to avoid repeated lookups
    this.updateSelectedLanguageName();
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  selectLanguage(code: string): void {
    this.selectedLanguage = code;
    this.isOpen = false;
    this.updateSelectedLanguageName();
    this.languageChange.emit(code);
  }

  getSelectedLanguageName(): string {
    return this.selectedLanguageName;
  }

  private updateSelectedLanguageName(): void {
    const lang = this.languages.find(l => l.code === this.selectedLanguage);
    this.selectedLanguageName = lang?.name || 'English';
  }

  // Track by function for better performance with *ngFor
  trackByCode(index: number, language: Language): string {
    return language.code;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    // Only check if dropdown is open to avoid unnecessary work
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}

