import { Box, Button, CircularProgress, Typography } from "@mui/material";
import Alert from "@mui/material/Alert";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue, useSetRecoilState } from "recoil";
import dayjs from "dayjs";
import {
  configAtom,
  notificationBadgeCountSelector,
  isRetryConfigAtom,
} from "../atoms";
import { useGetConfiguration } from "../server/api/useGetConfiguration";
import { isInIframe } from "../utils";
import { i18nLanguages } from "../components/header/SettingMenu";
import { LoaderContainer } from "../components/shared/LoaderContainer";
import {PrefStorage} from "../modules/storage/PrefStorage.ts";

type BootstrapState =
  | "idle"
  | "fetching"
  | "done"
  | "error"
  | "license_error"
  | "check_login"
  | "logout"
  | "logoutDone";

export const InitializerProvider = ({children}: { children: JSX.Element; }) => {
  const chatbotConfig = useRecoilValue(configAtom);
  const setIsRetryConfig = useSetRecoilState(isRetryConfigAtom);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>("idle");
  const [fontLoaded, setFontLoaded] = useState<boolean>(false);
  const badgeCount = useRecoilValue(notificationBadgeCountSelector);
  const fetchConfiguration = useGetConfiguration();
  const { t, i18n } = useTranslation();

  const handleWindowMessages = (ev: any) => {
    try {
      const message = JSON.parse(ev.data);
      const { messageType } = message;
      switch (messageType) {
        case "logout":
          setBootstrapState("logout");
          break;
      }
    } catch (e) {
      console.log("Invalid message", e);
    }
  };

  const manageLanguagePreferences = async () => {
    try {
      let preferredLanguage = window.localStorage.getItem("KristaChatbotLanguage");
      if (!preferredLanguage ||
        !i18nLanguages.find((ln) => ln.key === preferredLanguage)) {
        preferredLanguage = "en";
      }
      if (preferredLanguage !== i18n.resolvedLanguage) {
        i18n.changeLanguage(preferredLanguage);
        window.localStorage.setItem("KristaChatbotLanguage", preferredLanguage);
      }
      dayjs.locale(preferredLanguage);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRetry = () => {
    setIsRetryConfig(true);
    setBootstrapState("fetching");
    fetchConfiguration();
  };

  const handleClose = () => {
    window.parent?.postMessage(`{"messageType": "minimize", "value":true}`, "*");
  };

  useEffect(() => {
    setBootstrapState("fetching");
    fetchConfiguration();
    manageLanguagePreferences();

    const selectedLanguage = PrefStorage.getSelectedLanguage();
    i18n.changeLanguage(selectedLanguage);

    if (isInIframe) {
      window.addEventListener("message", handleWindowMessages, false);
    }
    return () => {
      if (isInIframe) {
        window.removeEventListener("message", handleWindowMessages);
      }
    };
  }, []);

  useEffect(() => {
    if (chatbotConfig && chatbotConfig._apiStatus_ === "success") {
      setBootstrapState("check_login");
    } else if (chatbotConfig && chatbotConfig._apiStatus_ === "error") {
      setBootstrapState("error");
      window.parent?.postMessage(
        JSON.stringify({
          messageType: "chatbotConfigError",
          value: chatbotConfig?._error_?.errorMessage,
        }),
        "*"
      );
    }
  }, [chatbotConfig]);

  useEffect(() => {
    if (chatbotConfig && chatbotConfig._apiStatus_ === "success") {
      const fontImportUrl = chatbotConfig.config.theme?.fontImportUrl;
      const fontFamily = chatbotConfig.config.theme?.fontFamily;

      if (fontImportUrl && fontFamily) {
        setFontLoaded(false);
        const existingLink = document.querySelector(`link[href="${fontImportUrl}"]`);
        if (!existingLink) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = fontImportUrl;
          link.crossOrigin = 'anonymous';

          link.onload = () => {
            setFontLoaded(true);
          };

          link.onerror = () => {
            console.error('Failed to load font from URL early:', fontImportUrl);
            setFontLoaded(true);
          };

          document.head.appendChild(link);
        } else {
          // Font already exists, mark as loaded
          setFontLoaded(true);
        }
      } else {
        setFontLoaded(true);
      }
    }
  }, [chatbotConfig]);

  useEffect(() => {
    switch (bootstrapState) {
      case "check_login":
        setBootstrapState("done");
        window.parent?.postMessage(`{"messageType": "getConfigDone", "value":""}`, "*");
        break;
    }
  }, [bootstrapState]);

  useEffect(() => {
    const message = {
      messageType: badgeCount > 0 ? "unreadNotification" : "clearUnreadNotification",
      value: badgeCount,
    };
    window.parent?.postMessage(JSON.stringify(message), "*");
  }, [badgeCount]);

  let jsx: JSX.Element | null;
  switch (bootstrapState) {
    case "fetching":
      jsx = (
        <LoaderContainer>
          <CircularProgress />
          <Typography variant="body2">
            {t("initializerProvider.fetching")}
          </Typography>
        </LoaderContainer>
      );
      break;
    case "check_login":
      jsx = (
        <LoaderContainer>
          <CircularProgress />
          <Typography variant="body2">
            {t("initializerProvider.initializing")}
          </Typography>
        </LoaderContainer>
      );
      break;
    case "error":
      jsx = (
        <LoaderContainer>
          <Alert severity="error">
            <Typography variant="body2">
              {t("initializerProvider.initFail")}
            </Typography>
            {chatbotConfig._error_?.errorMessage ? (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {t("initializerProvider.reason", {
                    errorMessage: chatbotConfig._error_?.errorMessage,
                  })}
                </Typography>
              </Box>
            ) : null}
            <Box sx={{ mt: 2, display: "flex", gap: "16px" }}>
              <Button
                variant="outlined"
                onClick={handleRetry}
                sx={{ textTransform: "none" }}
              >
                {t("general.retry")}
              </Button>
              <Button
                variant="outlined"
                onClick={handleClose}
                sx={{ textTransform: "none" }}
              >
                {t("general.close")}
              </Button>
            </Box>
          </Alert>
        </LoaderContainer>
      );
      break;
    case "done":
      if (!fontLoaded) {
        jsx = (
          <LoaderContainer>
            <CircularProgress />
            <Typography variant="body2">
              {t("initializerProvider.loadingFonts", "Loading fonts...")}
            </Typography>
          </LoaderContainer>
        );
      } else {
        jsx = children;
      }
      break;
    default:
      jsx = null;
  }

  return jsx;
};
