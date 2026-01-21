type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
type HEX = `#${string}`;

export type Color = RGB | RGBA | HEX;
export interface ITheme {
  palette: {
    primary: {
      main: Color;
      contrastText: Color;
    };
    secondary: {
      main: Color;
      contrastText: Color;
    };
    text: {
      primary: Color;
      secondary: Color;
      disabled: Color;
    };
    error: {
      main: Color;
      contrastText: Color;
    };
    warning: {
      main: Color;
      contrastText: Color;
    };
    info: {
      main: Color;
      contrastText: Color;
    };
    success: {
      main: Color;
      contrastText: Color;
    };
    background: {
      default: Color;
      paper: Color;
    };
    divider: Color;
  };
}

export type ThemeListener = (data: { mode: string; theme: ITheme }) => void;
