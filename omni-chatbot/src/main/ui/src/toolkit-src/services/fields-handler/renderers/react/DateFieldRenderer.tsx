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
import { useTheme, styled } from "@mui/material/styles";
import FormControl from "@mui/material/FormControl";
import { Box } from "@mui/material";
import Typography from "@mui/material/Typography";
import i18next from "i18next";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { timestampToAgnosticDate } from "../../state-managers/classes/utils";
import { FieldTypes } from "../../state-managers";
import { Priorities } from "../../Priorities";
import { datePlus } from "../../utils";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { MessageType } from "../../../messaging";

// Styled wrapper to ensure font family is applied
const StyledDatePickerWrapper = styled(Box)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  "& .rc-picker": {
    fontFamily: theme.typography.fontFamily,
  },
  "& .rc-picker-input > input": {
    fontFamily: theme.typography.fontFamily,
  },
}));

const locales: { [key: string]: Locale } = {
  en: enUS,
  fr: frFR,
  es: esES,
  de: deDE,
  hi: hiIN,
  mr: hiIN,
};

const mapper = {
  "000": "none",
  "001": "future",
  "010": "today",
  "011": "todayFuture",
  "100": "past",
  "101": "noToday",
  "110": "todayPast",
  "111": "all",
};

const dateHelperText = {
  future: (date: string) => i18next.t("krista.date.selectAfter", { date }),
  today: (date: string) => i18next.t("krista.date.select", { date }),
  todayFuture: (date: string) =>
    i18next.t("krista.date.selectOnOrAfter", { date }),
  past: (date: string) => i18next.t("krista.date.selectBefore", { date }),
  noToday: (date: string) =>
    i18next.t("krista.date.selectBeforeOrAfterDate", { date }),
  todayPast: (date: string) =>
    i18next.t("krista.date.selectOnOrBefore", { date }),
};

function getSelectionHelpText(picker: string, date: string): string {
  switch (picker) {
    case "future":
    case "today":
    case "todayFuture":
    case "past":
    case "noToday":
    case "todayPast":
      return dateHelperText[picker](date);
    default:
      return "";
  }
}

export const DateFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const theme = useTheme();
  const [value, setValue] = useState<Dayjs | null>(() => {
    const initialValue = kristaTypeField.getKristaValue().getValue();
    return initialValue ? dayjs(initialValue) : null;
  });
  const [refresh, doRefreshMeta] = useState(Date.now()); // to refresh meta content when picker is opened
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const {
    defaultFormat,
    picker,
    startOfToday,
    endOfToday,
    timezone,
    startOfTomorrow,
    helpText,
    tooltip,
  } = useMemo(() => {
    const _timezone = kristaTypeField.attributes.get("timezone");
    const _defaultFormat = "ll";
    const _picker = (mapper as any)[
      `${kristaTypeField.attributes.get("allowPast") ? 1 : 0}${
        kristaTypeField.attributes.get("allowToday") ? 1 : 0
      }${kristaTypeField.attributes.get("allowFuture") ? 1 : 0}`
    ];
    const _startOfToday = timestampToAgnosticDate(
      Date.now(),
      _timezone
    ).startOf("day");
    const _endOfToday = timestampToAgnosticDate(Date.now(), _timezone).endOf(
      "day"
    );
    const _startOfTomorrow = _startOfToday.add(1, "day");
    let _helpText: string = getSelectionHelpText(
      _picker,
      _startOfToday.format("ll")
    );
    return {
      tooltip: kristaTypeField.attributes.toolTip,
      defaultFormat: _defaultFormat,
      picker: _picker,
      startOfToday: _startOfToday,
      endOfToday: _endOfToday,
      timezone: _timezone,
      startOfTomorrow: _startOfTomorrow,
      helpText: _helpText,
    };
  }, [refresh]);

  const onChange = (newValue: Dayjs | null) => {
    let modifiedValue = newValue;
    if (modifiedValue) {
      modifiedValue = datePlus.stripTime(modifiedValue);
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

  function disabledDate(current: Dayjs) {
    switch (picker) {
      case "none":
        return true;
      case "future":
        return current.isBefore(startOfTomorrow);
      case "today":
        return current.isBefore(startOfToday) || current.isAfter(endOfToday);
      case "todayFuture":
        return current.isBefore(startOfToday);
      case "past":
        return current.isAfter(startOfToday);
      case "noToday":
        return current.isAfter(startOfToday) && current.isBefore(endOfToday);
      case "todayPast":
        return current.isAfter(endOfToday);
      case "all":
        return false;
      default:
        return false;
    }
  }

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
      <StyledDatePickerWrapper>
        <Picker
          {...sharedProps}
          allowClear
          className={`${theme.palette.mode}-mode ${
            kristaTypeField.isInsideTable ? "inside-table" : ""
          }`}
          disabled={kristaTypeField.readOnly || options.readOnly}
          disabledDate={disabledDate}
          dropdownClassName={`${theme.palette.mode}-mode`}
          format={kristaTypeField.attributes.get("dateFormat") || defaultFormat}
          locale={locales[dayjs.locale()] || enUS}
          placeholder={
            !(kristaTypeField.readOnly || options.readOnly)
              ? t("placeholder.select", { fieldName: kristaTypeField.label })
              : ""
          }
          showNow={false}
          renderExtraFooter={() => helpText}
          onOpenChange={(open: boolean) => {
            if (open) {
              doRefreshMeta(Date.now());
            }
          }}
        />
      </StyledDatePickerWrapper>
      {timezone && (
        <Typography variant="caption" component="span" color="text.secondary">
          {timezone}
        </Typography>
      )}
      {!kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

DateFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.DATE_FIELD:
      if (field.attributes.get("includeTimeOfDay")) {
        return Priorities.TypeFamily;
      }
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
