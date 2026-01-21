import React from "react";
import Typography from "@mui/material/Typography";
import { Box } from "@mui/material";
import { FormLabel } from "./FormLabel";

interface ReadOnlyFieldContentProps {
  label: string;
  required: boolean;
  hideLabel: boolean;
  content: React.ReactNode;
  title?: string;
}

export function ReadOnlyFieldContent(props: ReadOnlyFieldContentProps) {
  const { label, required, hideLabel, content, title } = props;
  return (
    <Box>
      {!hideLabel && label ? (
        <FormLabel
          component="div"
          sx={{ marginBottom: "2px" }}
          required={required}
          text={label}
          title={title}
        />
      ) : null}
      <Typography
        component="div"
        sx={{
          fontSize: "0.875rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </Typography>
    </Box>
  );
}
