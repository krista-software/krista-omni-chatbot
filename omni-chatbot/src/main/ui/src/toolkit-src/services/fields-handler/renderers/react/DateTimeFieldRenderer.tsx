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

const dateTimeHelperText = {
  min: (min: string) => i18next.t("krista.date.selectAfter", { date: min }),
  max: (max: string) => i18next.t("krista.date.selectBefore", { date: max }),
  minmax: (min: string, max: string) =>
    i18next.t("krista.date.selectBetween", { min, max }),
  beforeAfter: (before: string, after: string) =>
    i18next.t("krista.date.selectBeforeDateOrAfterDate", { before, after }),
};

function getSelectionHelpText(
  picker: string,
  minDate: Dayjs | null,
  maxDate: Dayjs | null,
  before: Dayjs,
  after: Dayjs
): string {
  switch (picker) {
    case "future":
    case "todayFuture":
      if (minDate !== null) {
        return dateTimeHelperText.min(minDate.format("lll"));
      }
      return "";
    case "today":
      if (minDate !== null && maxDate !== null) {
        return dateTimeHelperText.minmax(
          minDate.format("lll"),
          maxDate.format("lll")
        );
      }
      return "";
    case "past":
    case "todayPast":
      if (maxDate !== null) {
        return dateTimeHelperText.max(maxDate.format("lll"));
      }
      return "";
    case "noToday":
      return dateTimeHelperText.beforeAfter(
        before.format("lll"),
        after.format("lll")
      );
    default:
      return "";
  }
}

export const DateTimeFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const theme = useTheme();
  const [refresh, doRefreshMeta] = useState(Date.now()); // to refresh meta content when picker is opened
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
  const {
    defaultFormat,
    minDate,
    picker,
    timezone,
    maxDate,
    startOfToday,
    endOfToday,
    helpText,
    tooltip,
  } = useMemo(() => {
    const _timezone = kristaTypeField.attributes.get("timezone");
    const _defaultFormat = "lll";
    const _picker = (mapper as any)[
      `${kristaTypeField.attributes.get("allowPast") ? 1 : 0}${
        kristaTypeField.attributes.get("allowToday") ? 1 : 0
      }${kristaTypeField.attributes.get("allowFuture") ? 1 : 0}`
    ];
    const _now = timestampToAgnosticDate(Date.now(), _timezone);
    let _minDate: Dayjs | null = null;
    let _maxDate: Dayjs | null = null;
    const _startOfToday = timestampToAgnosticDate(
      Date.now(),
      _timezone
    ).startOf("day");
    const _endOfToday = timestampToAgnosticDate(Date.now(), _timezone).endOf(
      "day"
    );
    const _startOfTomorrow = _startOfToday.add(1, "day");
    const _endOfYesterday = _endOfToday.add(-1, "day");
    switch (_picker) {
      case "future":
        _minDate = _startOfTomorrow;
        break;
      case "past":
        _maxDate = _endOfYesterday;
        break;
      case "today":
        _minDate = _now;
        _maxDate = _now;
        break;
      case "todayFuture":
        _minDate = _now;
        break;
      case "todayPast":
        _maxDate = _now;
        break;
      default:
        break;
    }
    let _helpText: string = getSelectionHelpText(
      _picker,
      _minDate,
      _maxDate,
      _endOfYesterday,
      _startOfTomorrow
    );
    return {
      tooltip: kristaTypeField.attributes.toolTip,
      defaultFormat: _defaultFormat,
      timezone: _timezone,
      picker: _picker,
      minDate: _minDate,
      maxDate: _maxDate,
      startOfToday: _startOfToday,
      endOfToday: _endOfToday,
      helpText: _helpText,
    };
  }, [refresh]);

  const onChange = (newValue: Dayjs | null) => {
    if (newValue) {
      if (minDate && newValue.isBefore(minDate)) {
        newValue = minDate;
      }
      if (maxDate && newValue.isAfter(maxDate)) {
        newValue = maxDate;
      }
    }
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

  function disabledDate(current: Dayjs) {
    if (minDate && maxDate) {
      if (minDate.isSame(maxDate)) {
        // Date time - [past, today, future] = [false, true, false] scenario
        return (
          current.isBefore(minDate, "day") || current.isAfter(maxDate, "day")
        );
      }
      return current.isBefore(minDate) || current.isAfter(maxDate);
    }
    if (picker === "noToday") {
      return current.isAfter(startOfToday) && current.isBefore(endOfToday);
    }
    if (!minDate && !maxDate) {
      return false;
    }
    if (minDate) {
      return current.isBefore(minDate, "day");
    }
    if (maxDate) {
      return current.isAfter(maxDate, "day");
    }
    return false;
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
      <Picker
        {...sharedProps}
        allowClear
        className={`${theme?.palette.mode}-mode ${
          kristaTypeField.isInsideTable ? "inside-table" : ""
        }`}
        disabled={kristaTypeField.readOnly || options.readOnly}
        disabledDate={disabledDate}
        dropdownClassName={`${theme?.palette.mode}-mode`}
        format={kristaTypeField.attributes.get("dateFormat") || defaultFormat}
        locale={locales[dayjs.locale()] || enUS}
        placeholder={
          !(kristaTypeField.readOnly || options.readOnly)
            ? t("placeholder.select", { fieldName: kristaTypeField.label })
            : ""
        }
        showNow={false}
        showTime={{
          use12Hours: true,
        }}
        renderExtraFooter={() => helpText}
        onOpenChange={(open: boolean) => {
          if (open) {
            doRefreshMeta(Date.now());
          }
        }}
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

DateTimeFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.DATE_FIELD:
      if (!field.attributes.get("includeTimeOfDay")) {
        return Priorities.TypeFamily;
      }
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
