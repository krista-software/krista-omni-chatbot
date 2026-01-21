import React, {useEffect, useMemo, useState} from "react";
import {styled} from "@mui/material/styles";
import SvgIcon from "@mui/material/SvgIcon";
import IconButton from "@mui/material/IconButton";
import {Box, CircularProgress} from "@mui/material";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  FieldsHandlerService,
  FOCUSABLE_FIELDS,
  KSDKMessage as Message,
  loadEntities,
  MessageType,
  SubmitType,
} from "../../../toolkit-src";
import {ErrorFocus} from "./ErrorFocus";
import {MessageTextRenderer} from "./MessageTextRenderer";
import {MessagePaths} from "./MessagePaths";
import {EphemeralComponent} from "./EphemeralComponent";
import {queryParamsOfHostedSite} from "../../atoms";
import { useRecoilValue } from "recoil";

const WrapperStyle = styled(Box)(({ theme }) => ({
  "& > *": {
    margin: "20px 0",
    "&:first-of-type": {
      marginTop: 0,
    },
    "&:last-child": {
      marginBottom: 0,
    },
  },
}));

export const FormMessageComponent = (props: {
  message: Message;
  sendFormData: (submitType?: SubmitType, submitValue?: string) => boolean;
  errorFields: string[];
  errorMessages: string[];
  isWelcomeMessage?: boolean
}) => {
  const [freezeFrom, setFreezeFrom] = useState(false);
  const [ephemeralTime, setEphemeralTime] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  const {message, errorFields, sendFormData, errorMessages, isWelcomeMessage} = props;
  const queryParams = useRecoilValue(queryParamsOfHostedSite);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // refresh the content if the form is frozen after timeout
  const formContent = useMemo(
    () => getFormContent(message),
    [message, freezeFrom]
  );

  function fillAndSendForm(): void {
    if (isWelcomeMessage && queryParams && !messageForm?.readOnly) {
      let formWasAutoFilled = false;
      if (message.form) {
        message.form.pages.forEach((page) => {
          page.fieldStates.forEach((field) => {
            const fieldId = field.fieldId || "";
            const valueFromQuery = queryParams[fieldId];
            if (valueFromQuery != null && valueFromQuery != "") {
              field.setValue(valueFromQuery);
              formWasAutoFilled = true;
            }
          });
        });

        //  Auto-submit if any field was autofilled
        if (formWasAutoFilled) {
          handleSendForm();
        }
      }
    }
  }

  useEffect(() => {
    fillAndSendForm();

    if (message.messageType === MessageType.Ask && message.timer) {
      const startTime = message.timer.startTime;
      const endTime = message.timer.endTime;
      setEphemeralTime({ start: startTime, end: endTime });
    }
  }, []);

  const messageForm = message.form;
  const canShowSendButton = messageForm &&
      !messageForm.readOnly &&
      formContent.paths.length === 0 &&
      !formContent.noAnswerForm;

  function canSubmitOnEnter(): boolean {
    if (canShowSendButton) {
      return messageForm.pages.length > 0 && messageForm?.pages[0].fieldStates.length == 1;
    }
    return false;
  }

  function autoFocusIfPossible(): boolean {
    if (messageForm && messageForm.pages.length > 0) {
      const firstPage = messageForm.pages[0];
      if (firstPage.fieldStates.length > 0) {
        const firstField = firstPage.fieldStates[0];
        return FOCUSABLE_FIELDS.includes(firstField?.fieldType);
      }
    }
    return false;
  }

  function handleSendForm(submitType?: SubmitType, submitValue?: string) {
    const isSent = sendFormData(submitType, submitValue);
    setIsSubmitting(isSent);
  }

  return (
    <>
      <Box
        sx={{
          overflow: "auto",
          ...(formContent.noAnswerForm
            ? { pointerEvents: "none", opacity: 0.5 }
            : {}),
        }}
      >
        <Box
          sx={{
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {formContent.messageText && !formContent.hideMessage && (
            <MessageTextRenderer message={formContent.messageText} />
          )}
          <React.Fragment>
            {!formContent.hideForm &&
            messageForm &&
            formContent.fieldsCount > 0 ? (
              <>
                {messageForm.pages.map((formPage, pageIndex) => (
                  <WrapperStyle key={`${formPage.title}-${pageIndex}`}>
                    {formPage.fieldStates.map((fieldState, index) => {
                      const Component = FieldsHandlerService.getFieldRenderer(
                        fieldState,
                        "react"
                      );
                      if (Component) {
                        return (
                          <div
                            key={fieldState.fieldId}
                            id={`${
                              message.executionId
                            }_${fieldState.fieldId.replace(/ /g, "_")}`}
                            style={{
                              width: fieldState.isComplex() || fieldState.readOnly
                                ? "auto"
                                : fieldState.attributes.visualWidthPx,
                              maxWidth: "100%",
                            }}
                          >
                            <Component
                              kristaTypeField={fieldState}
                              options={{
                                getEntities: loadEntities,
                                messageType: message.messageType,
                                autoFocus: index == 0 && autoFocusIfPossible(),
                                onEnter: () => {
                                  if (canSubmitOnEnter()) {
                                    handleSendForm()
                                  }
                                },
                              }}
                            />
                          </div>
                        );
                      }
                      return null;
                    })}
                  </WrapperStyle>
                ))}
              </>
            ) : null}
          </React.Fragment>
          <React.Fragment>
            {!formContent.hideForm && formContent.paths.length > 0 ? (
              <MessagePaths
                paths={formContent.paths}
                onClick={handleSendForm}
                submittedPath={formContent.submittedPath}
              />
            ) : null}
            <ErrorFocus
              executionId={message.executionId}
              errorFields={errorFields}
            />
          </React.Fragment>
          {errorMessages && errorMessages.length > 0 && (
            <Box sx={{ maxHeight: "3rem", overflow: "auto" }}>
              {errorMessages.map((err, index) => (
                <div key={index}>
                  <Typography variant="caption" color="error">
                    {err}
                  </Typography>
                </div>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      {(ephemeralTime ||
        (messageForm &&
          !messageForm.readOnly &&
          formContent.paths.length === 0)) && (
        <Stack px={1} pt={1} direction="row">
          {ephemeralTime ? (
            <EphemeralComponent
              message={message}
              ephemeralTime={ephemeralTime}
              freezeInput={(bool: boolean) => setFreezeFrom(bool)}
            />
          ) : null}
          {canShowSendButton && (
              <IconButton
                sx={{ ml: "auto" }}
                onClick={(e) => handleSendForm()}
                color="primary"
                aria-label="Submit form"
              >
                {isSubmitting ? (
                    <CircularProgress size={20} color="primary"/>
                ) : (
                  <SvgIcon color="inherit" viewBox="0 0 20 20" fontSize="small">
                    <path d="M5.6 10.7391L14.4 4.95652L7.2 14.0435V18.1739L10.4 14.8696L16 19L20 0L0 6.6087L5.6 10.7391Z" />
                  </SvgIcon>
                )}
              </IconButton>
            )}
        </Stack>
      )}
    </>
  );
};

export function getFormContent(message: Message) {
  const submitType = (message.submit?.type || "").toLowerCase();
  const submitValue = message.submit?.value;

  const form = message.form;
  let hideMessage =
    message.isSplit &&
    message.isAnswered &&
    !message.isIncoming &&
    form &&
    form.readOnly;
  let hideForm =
    message.isAnswered &&
    form &&
    form.readOnly &&
    message.isIncoming &&
    (message.hasValidForm || message.hasPath);
  let fieldsCount = 0;
  if (form) {
    form.pages.forEach((page) => {
      fieldsCount += page.fields.length;
    });
  }
  return {
    hideMessage,
    hideForm,
    fieldsCount,
    paths: message.paths || [],
    sidebars: message.sideConversations || [],
    isFormSubmitted: submitType === "path" || submitType === "submit",
    messageText: message.userMessage || "",
    noAnswerForm: submitType === SubmitType.no_answer,
    submittedPath: submitType === "path" ? submitValue : "",
  };
}
