import React from "react";
import MuiFormLabel, { FormLabelProps } from "@mui/material/FormLabel";

interface Props extends FormLabelProps {
  text: React.ReactNode;
  title?: string;
  component?: React.ElementType<any>;
}

export const FormLabel = (props: Props) => {
  return (
    <MuiFormLabel
      title={props.title}
      sx={{
        ...props.sx,
        fontSize: "0.8125rem",
        color: "text.primary",
        fontWeight: 500,
        wordBreak: "break-word",
        "&.Mui-focused": {
          color: "text.primary",
        },
        "& .MuiFormLabel-asterisk": {
          color: "error.main",
        },
      }}
      required={props.required}
      error={props.error}
      component={props.component || "label"}
    >
      {props.text}
    </MuiFormLabel>
  );
};
