import React, { useEffect, useMemo, useState } from "react";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import { useTranslation } from "react-i18next";
import Tooltip from "@mui/material/Tooltip";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { PickOneFieldAttributes } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { MessageType } from "../../../messaging";
import CustomSelect from "./components/CustomSelect";

export const PickOneFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState<string | null>(() => kristaTypeField.formattedValue || null);
  const { t } = useTranslation();
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const { radioOptions, emptyMessage, tooltip } = useMemo(() => {
    let _options: string[] = [];
    const attributes = kristaTypeField.attributes as PickOneFieldAttributes;
    if (kristaTypeField.readOnly || options.readOnly) {
      if (value) {
        _options = [value];
      }
    } else if (attributes.hasOptions) {
      _options = attributes.options;
    }
    let emptyMessage = "";
    if (_options.length === 0) {
      emptyMessage =
        kristaTypeField.readOnly || options.readOnly
          ? t("krista.radio.noSelection")
          : t("krista.radio.noOptions");
    }
    return {
      radioOptions: _options,
      tooltip: kristaTypeField.attributes.toolTip,
      emptyMessage,
    };
  }, []);

  function updateState(newValue: string | string[] | null): void {
    setValue(newValue as string | null);
    kristaTypeField.setValue(newValue || undefined);
  }

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  return (
    <FormControl fullWidth component="fieldset">
      {!kristaTypeField.isInsideTable && (
        <FormLabel
          component="legend"
          required={
            kristaTypeField.required && options.messageType !== MessageType.Inform
          }
          text={kristaTypeField.displayLabel}
          title={tooltip}
        />
      )}
      {kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
      {(!radioOptions || radioOptions.length === 0) && (
        <Box mt={1}>
          <Typography component="div">
            <Box sx={{ fontStyle: "italic" }}>{emptyMessage}</Box>
          </Typography>
        </Box>
      )}
      {kristaTypeField.readOnly || options.readOnly ? (
        <>
          {value && (
            <Box sx={{ marginTop: "2px" }}>
              <Tooltip title={value} enterDelay={500}>
                <div>
                  <ReadOnlyFieldContent
                    label={kristaTypeField.displayLabel}
                    required={
                      kristaTypeField.required && options.messageType !== MessageType.Inform
                    }
                    hideLabel
                    content={value}
                  />
                </div>
              </Tooltip>
            </Box>
          )}
        </>
      ) : radioOptions.length > 5 ? (
        <CustomSelect
          options={radioOptions}
          multiple={false}
          required={kristaTypeField.required}
          value={value}
          onChange={updateState}
          label={kristaTypeField.displayLabel}
          placeholder={kristaTypeField.attributes.toolTip || kristaTypeField.displayLabel}
          disabled={!!(kristaTypeField.readOnly || options.readOnly)}
        />
      ) : (
        <RadioGroup
          name={kristaTypeField.displayLabel}
          value={value}
          onChange={(e) => updateState(e.target.value)}
        >
          {radioOptions.map((option, index) => (
            <Tooltip key={index} title={option} enterDelay={500}>
              <FormControlLabel
                value={option}
                control={
                  <Radio
                    sx={{ py: "6px" }}
                    color="primary"
                    size="small"
                    disabled={!!(kristaTypeField.readOnly || options.readOnly)}
                  />
                }
                label={option}
                sx={{
                  wordBreak: "normal",
                  marginRight: 0,
                  marginLeft: "-10px",
                  maxWidth: "100%",
                  ".MuiFormControlLabel-label": {
                    fontSize: "0.875rem",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                }}
              />
            </Tooltip>
          ))}
        </RadioGroup>
      )}
      {!kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

PickOneFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.PICK_ONE_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
