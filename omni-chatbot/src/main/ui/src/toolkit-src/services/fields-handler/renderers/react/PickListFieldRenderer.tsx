import React, { useEffect, useMemo, useState } from "react";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import FormGroup from "@mui/material/FormGroup";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import Tooltip from "@mui/material/Tooltip";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { CheckboxesFieldAttributes } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { MessageType } from "../../../messaging";
import CustomSelect from "./components/CustomSelect";

export const PickListFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState<string[]>(
    () => kristaTypeField.getKristaValue().getValue() || []
  );
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const { t } = useTranslation();
  const { checkboxOptions, emptyMessage, tooltip } = useMemo(() => {
    let _options: string[] = [];
    const attributes = kristaTypeField.attributes as CheckboxesFieldAttributes;
    if (kristaTypeField.readOnly || options.readOnly) {
      if (value) {
        _options = value;
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
      checkboxOptions: _options,
      tooltip: kristaTypeField.attributes.toolTip,
      emptyMessage,
    };
  }, []);

  function updateState(val: string[]): void {
    setValue(val);
    kristaTypeField.setValue(val);
  }

  function onClickOption(option: string) {
    let newState = [...value];
    if (value.includes(option)) {
      newState = value.filter((v) => v !== option);
    } else {
      newState.push(option);
    }
    updateState(newState);
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
      {emptyMessage ? (
        <Box mt={1}>
          <Typography component="div">
            <Box sx={{ fontStyle: "italic" }}>{emptyMessage}</Box>
          </Typography>
        </Box>
      ) : null}
      {kristaTypeField.readOnly || options.readOnly ? (
        <>
          {value && value.length > 0 && (
            <Box sx={{ marginTop: "2px" }}>
              <Box component="ul" m={0} pl={2}>
                {value.map((option) => (
                  <Tooltip key={option} title={option} enterDelay={500}>
                    <li>
                      <Typography
                        component="div"
                        sx={{ wordBreak: "break-word", fontSize: "0.875rem" }}
                      >
                        {option}
                      </Typography>
                    </li>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}
        </>
      ) : checkboxOptions.length > 5 ? (
        <CustomSelect
          options={checkboxOptions}
          multiple={true}
          required={kristaTypeField.required}
          value={value}
          onChange={(newValue) => updateState(newValue as string[])}
          label={kristaTypeField.displayLabel}
          placeholder={kristaTypeField.attributes.toolTip || kristaTypeField.displayLabel}
          disabled={!!(kristaTypeField.readOnly || options.readOnly)}
        />
      ) : (
        <FormGroup>
          {checkboxOptions &&
            checkboxOptions.map((option) => (
              <Tooltip key={option} title={option} enterDelay={500}>
                <FormControlLabel
                  control={
                    <Checkbox
                      sx={{ py: "6px" }}
                      size="small"
                      color="primary"
                      disabled={kristaTypeField.readOnly || options.readOnly}
                      checked={value ? value.includes(option) : false}
                      onChange={() => onClickOption(option)}
                    />
                  }
                  label={option}
                  sx={{
                    wordBreak: "normal",
                    marginRight: 0,
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
        </FormGroup>
      )}
      {!kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

PickListFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.CHECKBOXES_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
