import { PaletteMode, Theme } from "@mui/material";
import { alpha, createTheme } from "@mui/material";
import { ITheme } from "../../toolkit-src";
import { CustomThemeColors } from "../atoms";

export const defaultOutgoingBubbleThemeColors: CustomThemeColors = {
  brandColor: "#0177C6",
  textColor: "#ffffff",
  dividerColor: "#cccccc",
};

export function getCustomThemePalette(
  defaultThemePalette: ITheme["palette"],
  customThemeColors?: CustomThemeColors
): ITheme["palette"] {
  return {
    primary: {
      main: customThemeColors?.brandColor || defaultThemePalette.primary.main,
      contrastText: defaultThemePalette.primary.contrastText,
    },
    secondary: {
      main: customThemeColors?.brandColor || defaultThemePalette.primary.main,
      contrastText: defaultThemePalette.primary.contrastText,
    },
    text: {
      primary: customThemeColors?.textColor || defaultThemePalette.text.primary,
      secondary: customThemeColors?.textColor || defaultThemePalette.text.secondary,
      disabled: defaultThemePalette.text.disabled,
    },
    error: {
      main: defaultThemePalette.error.main,
      contrastText: defaultThemePalette.error.contrastText,
    },
    warning: {
      main: defaultThemePalette.warning.main,
      contrastText: defaultThemePalette.warning.contrastText,
    },
    info: {
      main: defaultThemePalette.info.main,
      contrastText: defaultThemePalette.info.contrastText,
    },
    success: {
      main: defaultThemePalette.success.main,
      contrastText: defaultThemePalette.success.contrastText,
    },
    background: {
      default: defaultThemePalette.background.default,
      paper: defaultThemePalette.background.paper,
    },
    divider: customThemeColors?.dividerColor || defaultThemePalette.divider,
  };
}

export function getOutgoingBubbleThemePalette(
  customThemeColors: CustomThemeColors,
  defaultThemePalette: ITheme["palette"]
): ITheme["palette"] {
  return {
    primary: {
      main:
        customThemeColors.brandColor ||
        defaultOutgoingBubbleThemeColors.brandColor,
      contrastText:
        customThemeColors.textColor ||
        defaultOutgoingBubbleThemeColors.textColor,
    },
    secondary: {
      main:
        customThemeColors.brandColor ||
        defaultOutgoingBubbleThemeColors.brandColor,
      contrastText:
        customThemeColors.textColor ||
        defaultOutgoingBubbleThemeColors.textColor,
    },
    text: {
      primary:
        customThemeColors.textColor ||
        defaultOutgoingBubbleThemeColors.textColor,
      secondary:
        customThemeColors.textColor ||
        defaultOutgoingBubbleThemeColors.textColor,
      disabled: defaultOutgoingBubbleThemeColors.textColor,
    },
    error: {
      main: defaultThemePalette.error.main,
      contrastText: defaultThemePalette.error.contrastText,
    },
    warning: {
      main: defaultThemePalette.warning.main,
      contrastText: defaultThemePalette.warning.contrastText,
    },
    info: {
      main: defaultThemePalette.info.main,
      contrastText: defaultThemePalette.info.contrastText,
    },
    success: {
      main: defaultThemePalette.success.main,
      contrastText: defaultThemePalette.success.contrastText,
    },
    background: {
      default: defaultThemePalette.background.default,
      paper:
        customThemeColors.brandColor ||
        defaultOutgoingBubbleThemeColors.brandColor ||
        defaultThemePalette.background.paper,
    },
    divider:
      customThemeColors.dividerColor ||
      defaultOutgoingBubbleThemeColors.dividerColor ||
      defaultThemePalette.divider,
  };
}

export const getTheme = (
  mode: PaletteMode,
  palette: ITheme["palette"],
  customFontFamily?: string
): Theme => {
  // Default font stack with fallbacks
  const defaultFontFamily = [
    '"Roboto"',
    '"Helvetica"',
    'Arial',
    'sans-serif'
  ].join(',');

  // Use custom font family if provided, with fallbacks
  const fontFamily = customFontFamily
    ? `"${customFontFamily}", ${defaultFontFamily}`
    : defaultFontFamily;

  return createTheme({
    palette: {
      mode: mode as PaletteMode,
      ...palette,
    },
    typography: {
      fontFamily,
      body1: {
        fontSize: "0.875rem",
      },
      body2: {
        fontSize: "0.75rem",
        lineHeight: 1.5,
      },
      caption: {
        letterSpacing: "inherit",
      },
      button: {
        textTransform: "unset",
      },
    },
  });
};

export function getCSSVariables(theme: Theme) {
  return {
    "--krista-picker-primary": theme.palette.primary.main,
    "--krista-picker-contrast-text": theme.palette.primary.contrastText,
    "--krista-picker-text": theme.palette.text.primary,
    "--krista-picker-border": theme.palette.divider,
    "--krista-picker-panel-bg": theme.palette.background.default,
    "--krista-picker-days": theme.palette.text.secondary,
    "--krista-picker-date-focus-bg": alpha(
      theme.palette.text.primary,
      theme.palette.action.hoverOpacity
    ),
    "--krista-picker-font-family": theme.typography.fontFamily,
  };
}
