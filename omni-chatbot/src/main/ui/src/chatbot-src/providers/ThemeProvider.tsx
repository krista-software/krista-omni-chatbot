import { ReactNode, useEffect, useState } from "react";
import {
  StyledEngineProvider,
  ThemeProvider as MuiThemeProvider,
  Theme as MuiTheme,
} from "@mui/material/styles";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { PaletteMode } from "@mui/material";
import { KristaUIToolkit, ITheme } from "../../toolkit-src";
import {
  defaultOutgoingBubbleThemeColors,
  getCSSVariables,
  getCustomThemePalette,
  getOutgoingBubbleThemePalette,
  getTheme,
} from "./Theme";
import { outgoingBubbleThemeAtom, configAtom } from "../atoms";

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<MuiTheme | undefined>(undefined);
  const chatbotConfig = useRecoilValue(configAtom);
  const setOutgoingBubbleTheme = useSetRecoilState(outgoingBubbleThemeAtom);

  useEffect(() => {
    function setThemes(data: { mode: string; theme: ITheme }) {
      const palette = getCustomThemePalette(
        data.theme.palette,
        chatbotConfig.config.theme
      );
      setTheme(getTheme(data.mode as PaletteMode, palette, chatbotConfig.config.theme?.fontFamily));
      const _palette = getOutgoingBubbleThemePalette(
        chatbotConfig.config.theme || defaultOutgoingBubbleThemeColors,
        data.theme.palette
      );
      setOutgoingBubbleTheme(getTheme(data.mode as PaletteMode, _palette, chatbotConfig.config.theme?.fontFamily));
    }
    const themeService = KristaUIToolkit.getInstance().getThemeService();
    const themeCallback = (data: { mode: string; theme: ITheme }) => {
      setThemes(data);
    };
    themeService.registerCallback(themeCallback);
    themeService.getAllThemes().then(() => {
      setThemes(themeService.getSelectedThemeSettings());
    });
    return () => {
      themeService.removeCallback(themeCallback);
    };
  }, []);

  useEffect(() => {
    if (theme) {
      const css: any = getCSSVariables(theme);
      Object.keys(css).forEach((key: string) => {
        document.body.style.setProperty(key, css[key]);
      });
    }
  }, [theme]);

  if (!theme) {
    return null;
  }

  return (
    <StyledEngineProvider injectFirst>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </StyledEngineProvider>
  );
};
