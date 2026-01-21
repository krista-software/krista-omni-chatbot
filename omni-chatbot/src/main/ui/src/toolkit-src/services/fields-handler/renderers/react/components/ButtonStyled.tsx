import React from "react";
import { styled } from "@mui/material/styles";
import MuiButton from "@mui/material/Button";

export const ButtonStyled = styled(MuiButton)(({ theme }) => ({
  textTransform: "none",
  letterSpacing: "initial",
}));
