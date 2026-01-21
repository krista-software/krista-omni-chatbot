import { PaletteMode } from "@mui/material";
import { ITheme } from "./types";

export const defaultThemes: { [key in PaletteMode]: ITheme } = {
  dark: {
    palette: {
      primary: {
        main: "#4fd7ed",
        contrastText: "rgba(0, 0, 0, 0.87)",
      },
      secondary: {
        main: "#4fd7ed",
        contrastText: "rgba(0, 0, 0, 0.87)",
      },
      error: {
        main: "#f44336",
        contrastText: "#fff",
      },
      warning: {
        main: "#ffa726",
        contrastText: "rgba(0, 0, 0, 0.87)",
      },
      info: {
        main: "#29b6f6",
        contrastText: "rgba(0, 0, 0, 0.87)",
      },
      success: {
        main: "#66bb6a",
        contrastText: "rgba(0, 0, 0, 0.87)",
      },
      text: {
        primary: "rgb(220, 220, 220)",
        secondary: "rgba(220, 220, 220, 0.7)",
        disabled: "rgba(220, 220, 220, 0.5)",
      },
      background: {
        default: "#121212",
        paper: "#121212",
      },
      divider: "rgba(255, 255, 255, 0.12)",
    },
  },
  light: {
    palette: {
      primary: {
        main: "#0177C6",
        contrastText: "#fff",
      },
      secondary: {
        main: "#0177C6",
        contrastText: "#fff",
      },
      error: {
        main: "#ec4d4d",
        contrastText: "#fff",
      },
      warning: {
        main: "#ed6c02",
        contrastText: "#fff",
      },
      info: {
        main: "#0288d1",
        contrastText: "#fff",
      },
      success: {
        main: "#2e7d32",
        contrastText: "#fff",
      },
      text: {
        primary: "#212121",
        secondary: "#212121",
        disabled: "rgba(0, 0, 0, 0.38)",
      },
      background: {
        paper: "#fff",
        default: "#f6f6f7",
      },
      divider: "rgba(0, 0, 0, 0.2)",
    },
  },
};
