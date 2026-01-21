import React from "react";
import Modal from "@mui/material/Modal";
import { Box } from "@mui/material";

interface ImageModalProps {
  imageSrc: string;
  altText: string;
  handleClose: () => void;
}

export function ImageModal(props: ImageModalProps) {
  const { imageSrc, altText, handleClose } = props;

  return (
    <Modal open onClose={handleClose}>
      <Box
        sx={{ overflow: "auto", height: "100%", width: "100%" }}
        onClick={handleClose}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <Box
            sx={{
              maxHeight: "calc(100% - 16px)",
              maxWidth: "calc(100% - 16px)",
              position: "relative",
              "& img": {
                maxWidth: "100%",
              },
            }}
          >
            <img src={imageSrc} alt={altText} />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
