import React, {useEffect, useMemo, useRef, useState} from "react";
import { InputBaseComponentProps } from "@mui/material/InputBase";
import { TextFieldStyled } from "./TextFieldStyled";
import { TextRendererProps } from "./TextRenderer";
import { FieldErrorMessage } from "./FieldErrorMessage";

export function NumericRenderer(props: TextRendererProps) {
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
    formattedValue = "",
    onChange = () => {},
    onFocus = () => {},
    onBlur = () => {},
    onEnter = () => {},
    autoFocus = false,
  } = props;
  const [isFocused, setFocused] = useState(false);
  const { inputProps } = useMemo(() => {
    const _inputProps: InputBaseComponentProps = {};
    if (props.pattern) {
      _inputProps.pattern = props.pattern;
    }
    if (isInsideTable) {
      _inputProps.style = {
        textAlign: "right",
      };
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

  function getNewInputValue(
    event: React.KeyboardEvent<HTMLInputElement>
  ): string {
    const target = event.target as HTMLInputElement;
    let newValue = target.value;
    const valueArray = newValue.split("");
    if (target.selectionEnd !== null && target.selectionStart !== null) {
      const selectionLength = target.selectionEnd - target.selectionStart;
      if (event.key === "Backspace") {
        if (selectionLength === 0 && target.selectionStart > 0) {
          valueArray.splice(target.selectionStart - 1, selectionLength + 1);
        } else {
          valueArray.splice(target.selectionStart, selectionLength);
        }
      } else if (event.key === "Delete") {
        if (selectionLength === 0) {
          valueArray.splice(target.selectionStart, selectionLength + 1);
        } else {
          valueArray.splice(target.selectionStart, selectionLength);
        }
      } else {
        valueArray.splice(target.selectionStart, selectionLength, event.key);
      }
    }
    newValue = valueArray.join("");
    return newValue;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const regexForRealNumber = new RegExp("^-?\\d*[.]?\\d*$");
    const isAllowedKey = regexForRealNumber.test(event.key);
    const enteredKeyLength = event.key.length;
    if (!(enteredKeyLength > 1 || isAllowedKey || event.metaKey)) {
      event.preventDefault();
      return;
    }

    const fullValue = getNewInputValue(event);
    const fullValueIsValid = regexForRealNumber.test(fullValue);
    if (!(enteredKeyLength > 1 || fullValueIsValid || event.metaKey)) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter') {
      onEnter(event);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const copiedText: string = event.clipboardData.getData("text/plain");
    if (Number.isNaN(Number(copiedText))) {
      event.preventDefault();
      return;
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
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
        type={secured && !isFocused ? "password" : "text"}
        label={isInsideTable ? "" : <span title={title}>{label}</span>}
        value={isFocused ? value : formattedValue}
        hiddenLabel={isInsideTable}
        placeholder={placeholder || ""}
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
        onPaste={handlePaste}
      />
    </>
  );
}
