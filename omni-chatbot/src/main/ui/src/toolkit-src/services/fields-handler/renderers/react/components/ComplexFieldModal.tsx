import React from "react";
import { Box, Dialog, DialogContent, DialogActions } from "@mui/material";
import { useTranslation } from "react-i18next";
import { KristaFieldAttributes } from "../../../state-managers/field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../../state-managers/field-values/KristaValue";
import { KristaTypeField } from "../../../state-managers/fields/KristaTypeField";
import { FieldsHandlerService } from "../../../FieldsHandlerService";
import { ButtonStyled } from "./ButtonStyled";
import { FieldOptions } from "../../types";

interface Props {
  handleClose: () => void;
  state: KristaTypeField<KristaFieldAttributes, KristaValue>;
  options?: FieldOptions;
}

export function ComplexFieldModal(props: Props) {
  const { state, handleClose, options } = props;
  const { t } = useTranslation();
  const FormFieldRenderer = FieldsHandlerService.getFieldRenderer(
    state,
    "react"
  );
  return (
    <Dialog open onClose={handleClose} maxWidth="xl">
      <DialogContent dividers>
        <Box sx={{ overflow: "auto" }}>
          <FormFieldRenderer kristaTypeField={state} options={options} />
        </Box>
      </DialogContent>
      <DialogActions>
        <ButtonStyled autoFocus onClick={handleClose}>
          {t("krista.general.ok")}
        </ButtonStyled>
      </DialogActions>
    </Dialog>
  );
}
