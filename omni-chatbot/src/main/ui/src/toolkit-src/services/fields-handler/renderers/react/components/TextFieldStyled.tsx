import { styled } from "@mui/material/styles";
import MuiTextField from "@mui/material/TextField";

export const TextFieldStyled = styled(MuiTextField)(({ theme }) => ({
  // increasing specificity
  "& .MuiInput-root.MuiInput-root": {
    marginTop: 0,
    fontSize: "0.875rem",
    "&:before": {
      borderBottomColor: theme.palette.divider,
    },
    "&:after": {
      borderWidth: 1,
    },
    "&:hover:before": {
      borderWidth: 1,
    },
  },
  "& .MuiInputLabel-root.MuiInputLabel-root": {
    whiteSpace: "initial",
    position: "relative",
    transform: "none",
    fontSize: "0.8125rem",
    wordBreak: "break-word",
    color: theme.palette.text.primary, // this will override focus and error color too
    fontWeight: 500,
  },
  "& .MuiInputLabel-asterisk": {
    color: theme.palette.error.main,
  },
  "& .MuiInput-input": {
    padding: "6px 0",
  },
  "& .MuiFormHelperText-root": {
    letterSpacing: "initial",
  },
}));
