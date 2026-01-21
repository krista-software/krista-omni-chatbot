import React, {useState} from "react";
import IconButton from "@mui/material/IconButton";
import SvgIcon from "@mui/material/SvgIcon";
import {useTranslation} from "react-i18next";
import {useRecoilValue} from "recoil";
import {Box, Typography} from "@mui/material";
import {KristaId, MessageService, KSDKAccount} from "../../../toolkit-src";
import TextInputArea from "./TextInputArea";
import {configAtom, hideFooterAtom, sessionIdAtom, userDataAtom} from "../../atoms";
import {escapeHtml} from "../../utils";
import KristaLogo from "../../assets/images/krista-logo.svg";

export const Footer = () => {
  const [value, setValue] = useState("");
  const sessionId = useRecoilValue(sessionIdAtom);
  const userData = useRecoilValue(userDataAtom);
  const hideFooter = useRecoilValue(hideFooterAtom);
  const {t} = useTranslation();
  const config = useRecoilValue(configAtom);

  const sendInboxTextMessage = (sendMessage: string) => {
    if (userData) {
      MessageService.getInstance().sendInboxTextMessage(
        KristaId.parse(sessionId),
        new KSDKAccount(userData.accountId, userData.name),
        escapeHtml(sendMessage)
      );
      setValue("");
    }
  };

  const handleSendBtnClick = () => {
    //handling an empty message
    const sendMessage = String(value || "").trim();
    const valid = sendMessage.length > 0;
    if (valid) {
      sendInboxTextMessage(sendMessage);
    }
  };

  return (
    <Box sx={{
      height: "100%",
      padding: config.config.hideSendMessage ? "" : "0 16px 4px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      borderTop: "1px solid rgba(0, 0, 0, 0.12)",
      background: "white",
    }}>
      {config.config.hideSendMessage ? null : <Box sx={{display: "flex", alignItems: "center", height: "56px"}}>
        {!hideFooter ? (
          <>
            <TextInputArea
              placeholder={t("footer.sendMessage")}
              value={value}
              onChange={setValue}
              disabled={hideFooter}
              onEnterKeyPress={handleSendBtnClick}/>
            <IconButton
              focusRipple
              onClick={handleSendBtnClick}
              color="primary"
              size="large"
              disabled={!value || value.length === 0 || hideFooter}
              sx={{
                padding: "6px !important",
              }}>
              <SvgIcon
                color={
                  !value || value.length === 0 || hideFooter
                    ? "disabled"
                    : "primary"
                }
                viewBox="0 0 20 20"
                fontSize="small">
                <path d="M5.6 10.7391L14.4 4.95652L7.2 14.0435V18.1739L10.4 14.8696L16 19L20 0L0 6.6087L5.6 10.7391Z"/>
              </SvgIcon>
            </IconButton>
          </>
        ) : null}
      </Box>}
      <Box sx={{
          display: "flex",
          alignItems: "center",
          flex: "1 0",
          justifyContent: "center",
        }}>
        <Box sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px", // optional for spacing
            width: "100%",
          }}>
          {/* Centered Typography + Logo */}
          <Box sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline",
              gap: "4px",
              flex: 1,
            }}>
            <Typography sx={{
                fontSize: "11px",
                lineHeight: "16px",
                flexShrink: 0,
                opacity: 0.5,
              }}>
              Powered by
            </Typography>
            <img src={KristaLogo} style={{ maxWidth: 40 }} />
          </Box>

          {/* Right-Aligned T&C Link */}
          {config.config.TnC && (
            <a
              href={config.config.TnC}
              target="_blank"
              rel="noopener noreferrer"
              className="link-color"
              style={{
                fontSize: "11px",
                textDecoration: "underline",
              }}>
              {config.config.TnCLabel ? config.config.TnCLabel : "Terms & Conditions"}
            </a>
          )}
        </Box>
      </Box>
    </Box>
  );
};
