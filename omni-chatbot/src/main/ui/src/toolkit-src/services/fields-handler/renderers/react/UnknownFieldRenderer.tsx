import React from "react";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { KristaValue } from "../../state-managers/field-values";
import { KristaTypeField } from "../../state-managers/fields/KristaTypeField";
import { KristaFieldAttributes } from "../../state-managers/field-attributes/KristaFieldAttributes";

export const UnknownFieldRenderer = (({ kristaTypeField }) => {
  const { t } = useTranslation();
  return (
    <Box mt={1}>
      <Typography>{t("krista.general.unknownField")}</Typography>
    </Box>
  );
}) as ReactFieldRenderer;

UnknownFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  return Priorities.NotSupported;
};
