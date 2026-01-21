import React from "react";
import { Box } from "@mui/material";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { KSDKMessage } from "../../../toolkit-src";

export const AuthenticationMessageComponent = ({
  message,
}: {
  message: KSDKMessage;
}) => {
  const { t } = useTranslation();
  function authenticate() {
    const authUrl = message.authentication?.authUrl;
    if (authUrl) {
      const width = window.screen.height * 0.6;
      const height = window.screen.height * 0.6;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(
        authUrl,
        "popup",
        "width=" +
          width +
          ",height=" +
          height +
          ",menubar=0, top=" +
          top +
          ", left=" +
          left
      );
    }
  }
  return (
    <Box>
      <Typography component="p" sx={{ mb: 1 }}>
        {message.authentication?.systemName}
      </Typography>
      <Typography component="p" sx={{ mb: 1 }}>
        {t("krista.entity.authRequired")}
      </Typography>
      <Button variant="contained" onClick={() => authenticate()}>
        Authenticate
      </Button>
    </Box>
  );
};
