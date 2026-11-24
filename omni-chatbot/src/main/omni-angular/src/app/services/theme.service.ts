import { Injectable } from '@angular/core';
import { CustomThemeColors } from '../models/config.model';

/**
 * Theme Service
 * Manages dynamic theme application using CSS variables
 * Matches original app's Theme.ts implementation
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // NOTE: These defaults are mirrored by the Integration Settings "Live Preview"
  // (src/main/resources/integration/index.html). Keep them in sync if changed.
  private readonly defaultBrandColor = '#0177C6';
  private readonly defaultTextColor = '#212121';
  private readonly defaultDividerColor = 'rgba(0, 0, 0, 0.2)';
  private readonly defaultFontFamily = '"Roboto", "Helvetica", Arial, sans-serif';

  constructor() {}

  /**
   * Apply theme colors to CSS variables
   * Matches original app's getCustomThemePalette and getCSSVariables
   */
  applyTheme(theme?: CustomThemeColors): void {
    // Handle empty strings as undefined (treat "" as no value provided)
    const brandColor = (theme?.brandColor && theme.brandColor.trim()) || this.defaultBrandColor;
    const textColor = (theme?.textColor && theme.textColor.trim()) || '';
    const dividerColor = (theme?.dividerColor && theme.dividerColor.trim()) || this.defaultDividerColor;

    // Normalize font family: replace + with space (e.g., "Gravitas+One" -> "Gravitas One")
    const normalizedFontFamily = theme?.fontFamily?.replace(/\+/g, ' ');
    const fontFamily = normalizedFontFamily
      ? `"${normalizedFontFamily}", ${this.defaultFontFamily}`
      : this.defaultFontFamily;

    // Apply CSS variables to document root
    const root = document.documentElement;

    // Primary/Brand Color (used for buttons, links, user messages, etc.)
    root.style.setProperty('--krista-primary', brandColor);
    root.style.setProperty('--krista-color-primary', brandColor);
    root.style.setProperty('--krista-color-secondary', brandColor);

    // Text Colors for bot messages and form fields
    // Only set if textColor is provided and not empty
    if (textColor) {
      root.style.setProperty('--krista-text-primary', textColor);
      root.style.setProperty('--krista-text-secondary', textColor);
      root.style.setProperty('--kr-text-color-primary', textColor);
      root.style.setProperty('--kr-text-color-secondary', textColor);
    } else {
      // Reset to default if no textColor provided
      root.style.setProperty('--krista-text-primary', this.defaultTextColor);
      root.style.setProperty('--krista-text-secondary', this.defaultTextColor);
      root.style.setProperty('--kr-text-color-primary', this.defaultTextColor);
      root.style.setProperty('--kr-text-color-secondary', this.defaultTextColor);
    }

    // User message text color:
    // - If textColor is provided and not empty, use it for user messages
    // - If textColor is NOT provided or empty, use white for user messages (default)
    const userTextColor = textColor || 'white';
    root.style.setProperty('--krista-user-text-color', userTextColor);

    // Divider Color
    if (dividerColor) {
      root.style.setProperty('--krista-divider', dividerColor);
      root.style.setProperty('--kr-color-border', dividerColor);
    }

    // Font Family
    root.style.setProperty('--krista-font-family', fontFamily);
    document.body.style.fontFamily = fontFamily;

    // User message background (matches original's outgoingBubbleTheme)
    root.style.setProperty('--krista-user-message-bg', brandColor);
  }

  /**
   * Load custom font from URL
   * Matches original app's InitializerProvider font loading (lines 113-143)
   */
  loadCustomFont(fontImportUrl: string, fontFamily: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Normalize font family: replace + with space
      const normalizedFontFamily = fontFamily.replace(/\+/g, ' ');

      // Check if font is already loaded
      const existingLink = document.querySelector(`link[href="${fontImportUrl}"]`);
      if (existingLink) {
        resolve();
        return;
      }

      // Create link element for font
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontImportUrl;
      link.crossOrigin = 'anonymous';

      link.onload = () => {
        resolve();
      };

      link.onerror = () => {
        console.error(`❌ Failed to load font from URL: ${fontImportUrl}`);
        reject(new Error(`Failed to load font: ${fontImportUrl}`));
      };

      document.head.appendChild(link);
    });
  }

  /**
   * Apply theme with font loading
   * Combines theme application and font loading
   */
  async applyThemeWithFont(theme?: CustomThemeColors): Promise<void> {
    // Apply colors first
    this.applyTheme(theme);

    // Load custom font if provided
    if (theme?.fontImportUrl && theme?.fontFamily) {
      try {
        await this.loadCustomFont(theme.fontImportUrl, theme.fontFamily);
      } catch (error) {
        console.error('Font loading failed, using default font', error);
      }
    }
  }

  /**
   * Reset theme to defaults
   */
  resetTheme(): void {
    this.applyTheme(undefined);
  }
}

