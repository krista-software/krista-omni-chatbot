import React, { useEffect, useState } from "react";
import { styled } from "@mui/material/styles";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import MuiSwitch, { SwitchProps } from "@mui/material/Switch";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";

import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { ReactFieldRenderer } from "../types";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";

const Switch = styled((props: SwitchProps) => (
  <MuiSwitch
    focusVisibleClassName=".Mui-focusVisible"
    disableRipple
    {...props}
  />
))(({ theme }) => ({
  width: 32,
  height: 18,
  padding: 0,
  "& .MuiSwitch-switchBase": {
    padding: 0,
    margin: 2,
    transitionDuration: "300ms",
    "&.Mui-checked": {
      transform: "translateX(14px)",
      color: theme.palette.background.default,
      "& + .MuiSwitch-track": {
        opacity: 1,
        backgroundColor: theme.palette.primary.main,
      },
      "&.Mui-disabled": {
        color: theme.palette.background.default,
        "& + .MuiSwitch-track": {
          opacity: 1,
        },
      },
    },
    "&.Mui-focusVisible .MuiSwitch-thumb": {
      color: "#33cf4d",
      border: "6px solid #fff",
    },
    "&.Mui-disabled + .MuiSwitch-track": {
      opacity: 1,
    },
  },
  "& .MuiSwitch-thumb": {
    boxSizing: "border-box",
    width: 14,
    height: 14,
  },
  "& .MuiSwitch-track": {
    borderRadius: 9,
    opacity: 1,
    borderColor: theme.palette.divider,
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: "rgba(0, 0, 0, 0.26)",
    transition: theme.transitions.create(["background-color"], {
      duration: 400,
    }),
  },
}));

export const SwitchFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState(
    () => kristaTypeField.getKristaValue().getValue() || false
  );
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    setValue(checked);
    kristaTypeField.setValue(checked);
  }

  useEffect(() => {
    if (!kristaTypeField.getKristaValue().getValue()) {
      kristaTypeField.setValue(false);
    }
  }, []);

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  return (
    <FormControl fullWidth>
      <FormControlLabel
        control={
          <Box
            sx={{
              width: "100%",
            }}
          >
            <Switch
              size="small"
              color="primary"
              checked={value}
              onChange={handleChange}
              disabled={kristaTypeField.readOnly || options.readOnly}
            />
          </Box>
        }
        label={
          kristaTypeField.isInsideTable ? null : (
            <Box>
              <FormLabel
                sx={{ mb: 0.5, display: "block" }}
                text={kristaTypeField.displayLabel}
                title={kristaTypeField.attributes.toolTip}
              />
            </Box>
          )
        }
        disabled={kristaTypeField.readOnly || options.readOnly}
        labelPlacement="top"
        sx={{
          m: 0,
          alignItems: "flex-start",
          borderRadius: "4px",
        }}
      />
      {error ? (
        <Box>
          <Typography variant="caption" component="span" color="error">
            {error}
          </Typography>
        </Box>
      ) : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

SwitchFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.SWITCH_FIELD:
    case FieldTypes.BOOLEAN_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
