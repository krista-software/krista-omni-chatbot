import React from 'react';
import { Autocomplete, Checkbox, TextField, Radio, Popper, Tooltip } from '@mui/material';

interface CustomSelectProps {
  options: string[];
  multiple: boolean;
  required: boolean;
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  label: string;
  placeholder: string;
  disabled: boolean;
}

const CustomPopper = function (props: any) {
  return (
    <Popper
      {...props}
      placement="top-start"
    />
  );
};

const CustomSelect: React.FC<CustomSelectProps> = ({ options, multiple, value, onChange, label, placeholder, disabled, required}) => {
  const [isFocused, setIsFocused] = React.useState(false); 
  return (
    <Autocomplete
      size='small'
      multiple={multiple}
      limitTags={1}
      options={options}
      value={value}
      readOnly={disabled}
      disableClearable={required}
      disableCloseOnSelect={multiple}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      PopperComponent={CustomPopper}
      onChange={(event, newValue, reason, details) => {
        if (Array.isArray(newValue)) {
          onChange(newValue as string[]);
        } else {
          onChange(newValue as string | null);
        }
      }}
      renderInput={(params) => {
        const { InputProps, ...restParams } = params;
        const { startAdornment, ...restInputProps } = InputProps;
        return (
          <TextField
            {...restParams}
            placeholder={placeholder}
            variant="standard"
            InputProps={ {
              ...restInputProps,
              startAdornment: (
                isFocused ? 
                (<div 
                  style={{
                    maxHeight: '56px',
                    overflowY: 'auto',
                  }}
                  ref={(el) => {
                    if (el) {
                      el.scrollTop = el.scrollHeight;
                    }
                  }}
                >
                  {startAdornment}
                </div>) :
                startAdornment
              ),
            }}
            sx={{
              "& .MuiInput-root": {
                paddingTop: "3px",
              },
              "& .MuiInputBase-root:hover": {
                borderBottom: "none"
              },
              "& .MuiInputBase-root::after": {
                borderBottom: "1px solid #3871E0" 
              },
              "& .MuiInputBase-root::before": {
                borderBottom: "1px solid rgba(0, 0, 0, 0.2)" 
              },
              "& .css-8b8k60-MuiInputBase-root-MuiInput-root:hover:not(.Mui-disabled, .Mui-error):before": {
                borderBottom: "1px solid rgba(0, 0, 0, 0.2)" 
              }
            }}
          />
        );
      }}
      renderOption={(props, option, { selected }) => (
        <li style={{
          padding: "3px 0px",
          display: 'flex',
          alignItems: 'center'
        }} {...props}>
          {multiple ? (
            <Checkbox
              size='small'
              checked={selected}
              disabled={disabled}
            />
          ) : (
            <Radio
              size='small'
              checked={selected}
              disabled={disabled}
            />
          )}
          <Tooltip title={option} enterDelay={500}>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexGrow: 1
            }}>{option}</span>
          </Tooltip>
        </li>
      )}
    />
  );
};

export default CustomSelect;