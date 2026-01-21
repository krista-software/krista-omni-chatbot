import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { KristaFieldAttributes } from "../../../state-managers/field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../../state-managers/field-values/KristaValue";
import { KristaTypeField } from "../../../state-managers/fields/KristaTypeField";
import { ComplexFieldModal } from "./ComplexFieldModal";
import { FieldOptions } from "../../types";

interface Props {
  state: KristaTypeField<KristaFieldAttributes, KristaValue>;
  options?: FieldOptions;
}

export function OpenInModalComponent(props: Props) {
  const { state, options } = props;
  const [open, setOpen] = useState(false);

  return (
    <React.Fragment>
      <IconButton
        aria-label="open"
        size="small"
        onClick={() => {
          setOpen(true);
        }}
        sx={{ fontSize: "1rem" }}
      >
        <OpenInNewIcon fontSize="inherit" />
      </IconButton>
      {open && (
        <ComplexFieldModal
          state={state}
          options={options}
          handleClose={() => setOpen(false)}
        />
      )}
    </React.Fragment>
  );
}
