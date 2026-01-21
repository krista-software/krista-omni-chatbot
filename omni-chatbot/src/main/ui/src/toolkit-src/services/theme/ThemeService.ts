import { PaletteMode } from "@mui/material";
import { ITheme, ThemeListener } from "./types";
import { defaultThemes } from "./defaultThemes";

// Clients have the flexibility to personalize the theme of our Krista Client application using our Studio (Admin application from Krista).
// The customization options are limited to specific areas, such as the primary color, font color, and colors for warnings, errors,
// and success elements etc. This customization is applicable to both light and dark modes.
// Based on these settings, we create predefined theme objects and utilize them to generate the appropriate Material UI theme.
// The Krista Client application is built using the Material-UI React library, ensuring seamless integration and consistent theming throughout the application.

export class ThemeService {
  private static instance: ThemeService;
  private listeners: ThemeListener[] = [];
  private themes: { [key in PaletteMode]: ITheme } = defaultThemes;
  private defaultTheme: PaletteMode = "light";
  private selectedTheme: PaletteMode = this.defaultTheme;

  private constructor() {}

  /**
   * A static method for getting a singleton instance of ThemeService
   * @static
   * @returns {ThemeService} A singleton instance of ThemeService
   */
  public static getInstance(): ThemeService {
    if (!this.instance) {
      this.instance = new ThemeService();
      // TODO storage solution
      const preference = window.localStorage.getItem("KristaThemePreference");
      if (preference) {
        this.instance.selectedTheme = preference as PaletteMode;
      }
    }
    return this.instance;
  }

  getSelectedTheme(): PaletteMode {
    return this.selectedTheme;
  }

  /**
   * Retrieves the selected theme settings based on the chosen theme (light or dark).
   *
   * @returns {Object} An object containing the selected theme mode and its corresponding theme settings.
   * @property {string} mode - The selected theme mode ("light" or "dark").
   * @property {Object} theme - The theme settings for the selected mode.
   */
  getSelectedThemeSettings(): { mode: string; theme: ITheme } {
    if (!this.themes[this.selectedTheme]) {
      this.selectedTheme = this.defaultTheme;
    }
    return {
      mode: this.selectedTheme,
      theme: this.themes[this.selectedTheme],
    };
  }

  setTheme(theme: PaletteMode): void {
    if (!this.themes[theme]) {
      theme = this.defaultTheme;
    }
    this.selectedTheme = theme;
    // TODO storage solution
    window.localStorage.setItem("KristaThemePreference", theme);
    this.informSubscribers();
  }

  private informSubscribers(): void {
    const themeSettings = this.getSelectedThemeSettings();
    this.listeners.forEach((listener) => {
      listener(themeSettings);
    });
  }

  registerCallback(callback: ThemeListener): void {
    this.listeners.push(callback);
  }

  removeCallback(callback: ThemeListener): void {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  // TODO make sure that this is always called first before accessing the service
  /**
   * This method will fetch any custom themes defined in Studio
   * and returns them along with the two default themes (light and dark) provided by Krista
   * @returns available themes
   */
  getAllThemes(nocache: boolean = false): Promise<{ [key: string]: ITheme }> {
    // in future releases, we will fetch custom themes - that are defined in Studio - using Client API
    // this.themes = defaultThemes;
    return Promise.resolve(this.themes);
  }
}
