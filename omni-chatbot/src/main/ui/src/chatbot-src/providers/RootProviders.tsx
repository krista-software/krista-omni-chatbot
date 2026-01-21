import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { RecoilRoot } from "recoil";
import CssBaseline from "@mui/material/CssBaseline";
import { AuthenticationProvider } from "./AuthenticationProvider";
import { InitializerProvider } from "./InitializerProvider";
import { ThemeProvider } from "./ThemeProvider";
import {SessionProvider} from "./SessionProvider";

interface Props {
  children: ReactNode;
}
export function RootProviders({ children }: Props) {
  let basePath = "/";
  if (window.basePath && window.basePath !== "__chatbotBasePath__") {
    basePath = window.basePath + "chatbot/ui/";
  }

  return (
    <RecoilRoot>
      <BrowserRouter basename={basePath}>
        <InitializerProvider>
          <AuthenticationProvider>
            <SessionProvider>
              <ThemeProvider>
                <CssBaseline enableColorScheme />
                {children}
              </ThemeProvider>
            </SessionProvider>
          </AuthenticationProvider>
        </InitializerProvider>
      </BrowserRouter>
    </RecoilRoot>
  );
}
