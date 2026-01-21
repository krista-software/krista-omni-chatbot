import TextField from "@mui/material/TextField";

export interface Props {
  placeholder: string;
  value: any;
  disabled?: boolean;
  onChange: (value: string) => void;
  onEnterKeyPress?: (event: any) => void;
}

const TextInputArea = ({
  placeholder,
  value,
  onEnterKeyPress,
  onChange,
  disabled = false,
}: Props) => {
  const handleChange = (event: any) => {
    const value = event.target.value;
    onChange(value);
  };

  const handleKeypress = (event: any) => {
    if (event.key === "Enter") {
      if (event.shiftKey || !onEnterKeyPress) {
        onChange(`${value}\n`);
        event.preventDefault();
      } else if (onEnterKeyPress && value) {
        onEnterKeyPress(event);
        event.preventDefault();
      }
    }
  };

  return (
    <TextField
      disabled={disabled}
      multiline
      maxRows={2}
      value={value}
      placeholder={placeholder}
      variant="standard"
      onChange={handleChange}
      onKeyPress={handleKeypress}
      className="w-100"
      InputProps={{
        disableUnderline: true,
      }}
    />
  );
};

export default TextInputArea;
