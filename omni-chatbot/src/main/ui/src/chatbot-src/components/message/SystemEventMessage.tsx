import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { KSDKMessage } from "../../../toolkit-src";

export function SystemEventMessage({ message }: { message: KSDKMessage }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ textAlign: "center", padding: "12px 0" }}>
      <Typography
        sx={{
          backgroundColor: "#dadada",
          padding: "4px 12px",
          borderRadius: "24px",
          fontSize: "12px",
          color: "#000",
          display: "inline-block",
        }}
        component="span"
      >
        {message.systemEventType === "join-task"
          ? t("agent.joined", { name: message.systemEventData?.account.name })
          : null}
        {message.systemEventType === "leave-task"
          ? t("agent.left", { name: message.systemEventData?.account.name })
          : null}
      </Typography>
    </Box>
  );
}
