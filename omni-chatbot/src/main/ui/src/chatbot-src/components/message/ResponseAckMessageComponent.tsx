import React, { useEffect, useRef, useState } from "react";
import Typography from "@mui/material/Typography";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import { useRecoilValue } from "recoil";
import { useTranslation } from "react-i18next";
import { KSDKMessage as Message } from "../../../toolkit-src";
import { useGetContact } from "../../server/api/useGetContact";
import { configAtom } from "../../atoms";

export const ResponseAckMessageComponent: React.FC<{ message: Message }> = ({
  message,
}) => {
  const chatbotConfig = useRecoilValue(configAtom);
  const isMounted = useRef(true);
  const [responseMessage, setResponseMessage] = useState<string>();
  const { t } = useTranslation();
  const { contact, loading } = useGetContact(
    chatbotConfig.workspaceId || undefined,
    message.responder!.accountId
  );

  useEffect(() => {
    if (!isMounted.current) {
      return;
    }
    if (!loading) {
      const contactName = contact?.name || t("responseAckCompRenderer.unnamed");
      const requiredResponseCount = message.responder!.requiredResponseCount;
      const currentResponseCount = message.responder!.currentResponseCount;

      let responseCount;
      if (requiredResponseCount >= 0) {
        responseCount = currentResponseCount + "/" + requiredResponseCount;
      } else {
        responseCount = currentResponseCount;
      }
      setResponseMessage(
        t("responseAckCompRenderer.responseAck", {
          _responseCount: responseCount,
          _contactName: contactName,
          _conversationName: message.executionTitle,
          _time: dayjs(message.responder!.responseTime).format("lll"),
        })
      );
    }
  }, [contact, loading]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <Box sx={{ overflow: "auto" }}>
      <Typography component="div">
        <div
          dangerouslySetInnerHTML={{
            __html: responseMessage || t("responseAckCompRenderer.loading"),
          }}
        ></div>
      </Typography>
    </Box>
  );
};
