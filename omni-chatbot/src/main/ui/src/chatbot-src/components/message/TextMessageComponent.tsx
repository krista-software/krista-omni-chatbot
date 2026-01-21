import React from "react";
import { Box } from "@mui/material";
import { KSDKMessage as Message } from "../../../toolkit-src";
import { MessageTextRenderer } from "./MessageTextRenderer";

export const TextMessageComponent: React.FC<{ message: Message }> = ({
  message,
}) => {
  return (
    <Box sx={{ overflow: "auto" }}>
      <MessageTextRenderer message={message.userMessage || ""} />
    </Box>
  );
};
