import React from "react";
import Typography from "@mui/material/Typography";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { KSDKMessage as Message } from "../../../toolkit-src";

export const UnknownMessageComponent: React.FC<{ message: Message }> = ({
  message,
}) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ overflow: "auto" }}>
      <Typography>{t("unknownMessageComponent.message")}</Typography>
    </Box>
  );
};
