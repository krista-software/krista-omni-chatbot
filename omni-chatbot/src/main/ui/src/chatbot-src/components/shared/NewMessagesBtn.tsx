import React from "react";
import {styled} from "@mui/material/styles";
import Button from "@mui/material/Button";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import {useTranslation} from "react-i18next";

const ButtonStyle = styled(Button)(({theme}) => ({
  position: "absolute",
  bottom: 16,
  right: 16,
  zIndex: 1,
  borderRadius: 20,
  boxShadow: "none",
  background: "#3f3920",
  color: theme.palette.background.paper,
  letterSpacing: "inherit",
  "&:hover": {
    boxShadow: "none",
    background: "#3f3920",
  },
}));

const NewMessagesBtn = ({onClick}: { onClick: any }) => {
  const {t} = useTranslation();
  return (
    <ButtonStyle
      variant="contained"
      startIcon={<ArrowDownwardIcon fontSize="small"/>}
      onClick={onClick}
    >
      {t("newMessagesBtn.newMessages")}
    </ButtonStyle>
  );
};

export default NewMessagesBtn;
