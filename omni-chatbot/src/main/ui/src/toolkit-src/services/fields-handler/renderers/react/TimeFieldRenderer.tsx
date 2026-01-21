import React, { useEffect, useMemo, useState } from "react";
import Picker from "rc-picker";
import dayjs, { Dayjs } from "dayjs";
import dayjsGenerateConfig from "rc-picker/lib/generate/dayjs";
import enUS from "rc-picker/lib/locale/en_US";
import esES from "rc-picker/lib/locale/es_ES";
import frFR from "rc-picker/lib/locale/fr_FR";
import deDE from "rc-picker/lib/locale/de_DE";
import hiIN from "rc-picker/lib/locale/hi_IN";
import { Locale } from "rc-picker/lib/interface";
import { useTheme } from "@mui/material/styles";
import FormControl from "@mui/material/FormControl";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { timestampToAgnosticDate } from "../../state-managers/classes/utils";
import { FieldTypes } from "../../state-managers";
import { Priorities } from "../../Priorities";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { datePlus } from "../../utils";
import { MessageType } from "../../../messaging";

const locales: { [key: string]: Locale } = {
  en: enUS,
  fr: frFR,
  es: esES,
  de: deDE,
  hi: hiIN,
  mr: hiIN,
};

export const TimeFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const theme = useTheme();
  const [value, setValue] = useState<Dayjs | null>(() => {
    const initialValue = kristaTypeField.getKristaValue().getValue();
    return initialValue
      ? timestampToAgnosticDate(initialValue, kristaTypeField.attributes.get("timezone"))
      : null;
  });
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const { defaultFormat, timezone, timePickerProps, tooltip } = useMemo(() => {
    const _timezone = kristaTypeField.attributes.get("timezone");
    const _defaultFormat = "LT";
    let timePickerProps: any = {
      mode: "time",
      picker: "time",
      showTime: {
        use12Hours: true,
      },
    };
    return {
      tooltip: kristaTypeField.attributes.toolTip,
      defaultFormat: _defaultFormat,
      timezone: _timezone,
      timePickerProps,
    };
  }, []);

  const onChange = (newValue: Dayjs | null) => {
    // let modifiedValue = newValue;
    // if (modifiedValue) {
    //   const today = correctDateToUTCStart(Date.now(), true, state.attributes.get("timezone"));
    //   const hours = modifiedValue.get("hour");
    //   const minutes = modifiedValue.get("minute");
    //   modifiedValue = today.set("hour", hours).set("minute", minutes);
    //   modifiedValue = datePlus.stripSeconds(modifiedValue);
    // }
    let modifiedValue = newValue;
    if (modifiedValue) {
      modifiedValue = datePlus.stripMilliSeconds(modifiedValue);
    }
    setValue(modifiedValue);
    kristaTypeField.setValue(modifiedValue ? modifiedValue.valueOf() : undefined);
  };

  const sharedProps = {
    generateConfig: {
      ...dayjsGenerateConfig,
      getNow: () => timestampToAgnosticDate(Date.now(), timezone),
    },
    value,
    onChange,
  };

  const { t } = useTranslation();

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  if (kristaTypeField.readOnly || options.readOnly) {
    return (
      <Box>
        <ReadOnlyFieldContent
          label={kristaTypeField.displayLabel}
          required={
            kristaTypeField.required && options.messageType !== MessageType.Inform
          }
          hideLabel={kristaTypeField.isInsideTable}
          content={kristaTypeField.formattedValue}
          title={tooltip}
        />
        {timezone && (
          <Typography variant="caption" component="span" color="text.secondary">
            {timezone}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <FormControl fullWidth>
      {!kristaTypeField.isInsideTable && (
        <FormLabel
          required={kristaTypeField.required}
          text={kristaTypeField.displayLabel}
          title={tooltip}
        />
      )}
      {kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
      <Picker
        {...sharedProps}
        {...timePickerProps}
        allowClear
        className={`${theme?.palette.mode}-mode ${
          kristaTypeField.isInsideTable ? "inside-table" : ""
        }`}
        disabled={kristaTypeField.readOnly || options.readOnly}
        dropdownClassName={`${theme?.palette.mode}-mode`}
        format={kristaTypeField.attributes.get("dateFormat") || defaultFormat}
        locale={locales[dayjs.locale()] || enUS}
        placeholder={
          !(kristaTypeField.readOnly || options.readOnly)
            ? t("placeholder.select", { fieldName: kristaTypeField.label })
            : ""
        }
        showNow={false}
      />
      {timezone && (
        <Typography variant="caption" component="span" color="text.secondary">
          {timezone}
        </Typography>
      )}
      {!kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

TimeFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.TIME_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
