import React, { useState, useEffect } from "react";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { Box } from "@mui/material";
import { useRecoilValue } from "recoil";
import {
  KSDKAccount,
  KristaId,
  MessageService,
  KristaFieldValueResolver,
  getSanitizedMarkup,
} from "../../../toolkit-src";
import { ImageModal } from "../shared/ImageModal";
import { sessionIdAtom, userDataAtom } from "../../atoms";
import { escapeHtml } from "../../utils";

const BoxStyle = styled(Box)(({ theme }) => ({
  fontSize: "0.875rem",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  "& kristabutton": {
    display: "inline-block",
    background: theme.palette.text.primary,
    color: theme.palette.background.paper,
    alignItems: "center",
    padding: theme.spacing(0.5, 1.5),
    borderRadius: "30px",
    cursor: "pointer",
    margin: theme.spacing(0.5, 0),
  },
}));

export function MessageTextRenderer({ message }: { message: string }) {
  const [imageProps, setImageProps] = useState({ src: "", alt: "" });
  const [modalVisible, setModalVisible] = useState(false);
  const userData = useRecoilValue(userDataAtom);
  const sessionId = useRecoilValue(sessionIdAtom);

  // Move the markup calculation to a useEffect to avoid state updates during render
  const [markup, setMarkup] = useState("");

  useEffect(() => {
    const resolved = KristaFieldValueResolver.escapeNestedKristaField(message);
    setMarkup(getSanitizedMarkup(resolved));
  }, [message]);

  function handleCustomLinkClick(event: any) {
    const targetElement = event.target;
    const tagName = targetElement.tagName;

    if (tagName === "IMG") {
      const { src, alt } = event.target;
      setImageProps({ src, alt });
      setModalVisible(true);
    }

    if (tagName === "KRISTA-BUTTON") {
      const type: string = targetElement.getAttribute("button-type");
      if (type && type.toLowerCase() === "option") {
        const name = targetElement.getAttribute("name");
        MessageService.getInstance().sendInboxTextMessage(
          KristaId.parse(sessionId),
          new KSDKAccount(userData.accountId, userData.name),
          escapeHtml(name)
        );
      }
    }
  }

  function closeImageModal() {
    setModalVisible(false);
  }

  return (
    <>
      <BoxStyle onClick={handleCustomLinkClick}>
        <Typography
          sx={{
            fontSize: "0.875rem",
            '& p': {margin: 0},
          }}
          dangerouslySetInnerHTML={{ __html: markup }}
        ></Typography>
      </BoxStyle>
      {modalVisible && (
        <ImageModal
          imageSrc={imageProps.src}
          altText={imageProps.alt}
          handleClose={closeImageModal}
        />
      )}
    </>
  );
}
