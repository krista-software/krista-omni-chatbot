import React, { useMemo, useState } from "react";
import { Box, Paper } from "@mui/material";
import Stack from "@mui/material/Stack";
import { ThemeProvider } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useRecoilValue } from "recoil";
import {
  KristaId,
  KSDKMessage as Message,
  MessageService,
  SubmitType,
} from "../../../toolkit-src";
import { TextMessageComponent } from "../message/TextMessageComponent";
import { ResponseAckMessageComponent } from "../message/ResponseAckMessageComponent";
import { UnknownMessageComponent } from "../message/UnknownMessageComponent";
import {
  FormMessageComponent,
  getFormContent,
} from "../message/FormMessageComponent";
import { TimestampLabel } from "./TimestampLabel";
import { AuthenticationMessageComponent } from "../message/AuthenticationMessageComponent";
import { MessageSidebars } from "../message/MessageSidebars";
import {
  configAtom,
  outgoingBubbleThemeAtom,
  sessionIdAtom,
} from "../../atoms";

interface TimelineMessageProps {
  topicId: string;
  message: Message;
  sidebarMsg?: boolean;
  isWelcomeMessage?: boolean;
}

function messageComponentPicker(msg: Message): React.FC<{ message: Message }> {
  if (msg.authentication) {
    return AuthenticationMessageComponent;
  }
  if (msg.responder) {
    return ResponseAckMessageComponent;
  }
  if (!msg.form && !msg.media) {
    return TextMessageComponent;
  }
  return UnknownMessageComponent;
}
export function MessageBubble(props: TimelineMessageProps) {
  const { message } = props;
  const formContent = useMemo(() => {
    if (message.form) {
      return getFormContent(message);
    }
    return null;
  }, [message]);
  const chatbotConfig = useRecoilValue(configAtom);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const outgoingBubbleTheme = useRecoilValue(outgoingBubbleThemeAtom);
  const sessionId = useRecoilValue(sessionIdAtom);

  function sendFormData(
    submitType: SubmitType = SubmitType.submit,
    submitValue: string = ""
  ): boolean {
    const form = message.form;
    if (form && !form.readOnly) {
      // no need to validate the form for sidebars
      let formValid = true;
      if (submitType !== SubmitType.sidebar) {
        const pages = form.pages;
        const newErrorFields: string[] = [];
        pages?.forEach((page) => {
          page.fieldStates.forEach((field) => {
            if (!field.validate()) {
              newErrorFields.push(field.fieldId);
              formValid = false;
            }
          });
        });
        setErrorFields(newErrorFields);
      }

      if (submitType === SubmitType.sidebar || formValid) {
        setErrorFields([]);
        setErrorMessages([]);
        const formResponse = form.prepareFormResponse();
        formResponse.submitType = submitType;
        formResponse.submitValue = submitValue;
        MessageService.getInstance().submitInboxMessage(
          KristaId.parse(sessionId),
          KristaId.parse(message.messageId),
          formResponse);
        return true;
      }
    }
    return false;
  }

  // useEffect(() => {
  //   MessageService.getInstance().sendMessageReceipt(
  //     KristaId.parse(props.workspaceId),
  //     message
  //   );
  // }, []);

  if (!outgoingBubbleTheme) return null;

  const Component = messageComponentPicker(message);
  const bubbleJSX = (
    <Paper
      elevation={0}
      color="primary"
      sx={{
        padding: "10px",
        borderRadius: message.isIncoming
          ? "0 10px 10px 10px"
          : "10px 0 10px 10px",
      }}
    >
      {message.form ? (
        <FormMessageComponent
          message={message}
          errorFields={errorFields}
          errorMessages={errorMessages}
          sendFormData={sendFormData}
          isWelcomeMessage={props.isWelcomeMessage}
        />
      ) : (
        <Box>
          <Component message={message} />
        </Box>
      )}
    </Paper>
  );
  return (
    <>
      {/* <div style={{ fontSize: "10px" }}>{message.messageId}</div> */}
      <Stack
        direction="column"
        alignItems={message.isIncoming ? "flex-start" : "flex-end"}
        sx={{ py: 1.5 }}
      >
        <Box
          sx={{
            maxWidth: "95%",
            minWidth: 250,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              marginBottom: "2px",
            }}
          >
            {message.isIncoming && message.senderAccount && (
              <Typography noWrap sx={{ fontSize: "0.75rem" }}>
                {message.senderAccount.id === chatbotConfig.kristaAccountId
                  ? chatbotConfig.config.botName || message.senderAccount.name
                  : message.senderAccount.name}
              </Typography>
            )}
            <Box sx={{ marginLeft: "auto" }}>
              <TimestampLabel time={message.creationTime} />
            </Box>
          </Stack>
          {message.isIncoming ? (
            bubbleJSX
          ) : (
            <ThemeProvider theme={outgoingBubbleTheme}>
              {bubbleJSX}
            </ThemeProvider>
          )}
        </Box>
        {formContent &&
        !formContent.hideForm &&
        formContent.sidebars.length > 0 ? (
          <MessageSidebars
            readOnly={formContent.isFormSubmitted || formContent.noAnswerForm}
            sidebars={formContent.sidebars}
            onClick={sendFormData}
          />
        ) : null}
      </Stack>
    </>
  );
}
