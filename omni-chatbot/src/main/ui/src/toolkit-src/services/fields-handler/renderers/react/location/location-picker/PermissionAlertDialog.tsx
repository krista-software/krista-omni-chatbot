import React from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { ButtonStyled } from "../../components/ButtonStyled";

export function PermissionAlertDialog({
  open,
  onClose,
  message,
}: {
  message: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <DialogContentText sx={{ fontSize: "0.875rem" }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <ButtonStyled onClick={onClose} color="primary" autoFocus>
          {t("krista.general.ok")}
        </ButtonStyled>
      </DialogActions>
    </Dialog>
  );
}
