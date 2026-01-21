import React, {
  ChangeEventHandler,
  FocusEventHandler, KeyboardEventHandler, useEffect,
  useMemo, useRef,
  useState,
} from "react";
import { FieldErrorMessage } from "./FieldErrorMessage";
import { TextFieldStyled } from "./TextFieldStyled";
import { getMaskedValue } from "../../../utils/fields";
import {InputBaseComponentProps} from "@mui/material/InputBase";

export function TextRenderer(props: TextRendererProps) {
  const {
    value,
    label,
    placeholder,
    title = "",
    required = false,
    secured = false,
    isInsideTable = false,
    readOnly = false,
    error = "",
    allowNewLineOnEnterKey = false,
    maxRows = 4,
    inputType = "text",
    formattedValue,
    onChange = () => {},
    onFocus = () => {},
    onBlur = () => {},
    onEnter = () => {},
    autoFocus = false,
  } = props;
  const [isFocused, setFocused] = useState(false);
  const displayValue = useMemo(() => {
    return secured ? getMaskedValue(formattedValue) : formattedValue;
  }, [formattedValue, secured]);
  const { inputProps } = useMemo(() => {
    const _inputProps: InputBaseComponentProps = {};
    if (props.pattern) {
      _inputProps.pattern = props.pattern;
    }
    return {
      inputProps: _inputProps,
    };
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e);
    if (!isFocused) {
      onBlur(e);
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    onFocus(e);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false);
    onBlur(e);
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (!allowNewLineOnEnterKey) {
        event.preventDefault();
      }
      onEnter(event);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
        // Set the cursor position to the end of the text
        const length = inputRef.current.value?.length;
        if (length) {
          inputRef.current.setSelectionRange(length, length);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {isInsideTable ? <FieldErrorMessage error={error} /> : null}
      <TextFieldStyled
        inputRef={inputRef}
        required={required}
        type={inputType}
        label={isInsideTable ? "" : <span title={title}>{label}</span>}
        value={isFocused ? value : displayValue}
        hiddenLabel={isInsideTable}
        placeholder={placeholder || ""}
        multiline={true}
        maxRows={maxRows}
        minRows={1}
        error={!readOnly && Boolean(error)}
        helperText={!isInsideTable && !readOnly && Boolean(error) ? error : ""}
        variant="standard"
        InputLabelProps={{
          shrink: true,
        }}
        fullWidth
        inputProps={inputProps}
        InputProps={{
          readOnly: readOnly,
          disableUnderline: readOnly || isInsideTable,
        }}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    </>
  );
}

export type TextRendererProps = {
  value: any;
  formattedValue: string;
  label: string;
  placeholder: string;
  title?: string;
  required?: boolean;
  secured?: boolean;
  isInsideTable?: boolean;
  readOnly?: boolean;
  error?: string;
  inputType?: "text" | "number" | "email" | "tel";
  maxRows?: number;
  allowNewLineOnEnterKey?: boolean;
  pattern?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLTextAreaElement | HTMLInputElement>;
  onBlur?: any;
  onEnter?: KeyboardEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
};
