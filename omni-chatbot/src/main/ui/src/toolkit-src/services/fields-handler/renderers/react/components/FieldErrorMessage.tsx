import React from "react";
import FormHelperText from "@mui/material/FormHelperText";

interface Props {
  error: string;
}

export function FieldErrorMessage({ error }: Props) {
  if (!error) {
    return null;
  }
  return (
    <FormHelperText sx={{ marginLeft: 0, letterSpacing: "initial" }} error>
      {error}
    </FormHelperText>
  );
}
