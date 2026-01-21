import React, { useEffect, useMemo, useState } from "react";
import { RangePicker } from "rc-picker";
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
import { TypeDateRange } from "../../state-managers/field-attributes/DateRangeFieldAttributes";
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
  "101": "all",
  "110": "todayPast",
  "111": "all",
};

const dateRangeHelperText = {
  minmax: (min: string, max: string) =>
    i18next.t("krista.dateRange.selectBetween", { min, max }),
  min: (min: string) => i18next.t("krista.dateRange.selectOnOrAfter", { min }),
  max: (max: string) => i18next.t("krista.dateRange.selectOnOrBefore", { max }),
  maxDays: (days: string) =>
    i18next.t("krista.dateRange.selectMaxDays", { days }),
  maxHours: (hours: string) =>
    i18next.t("krista.dateRange.selectMaxHours", { hours }),
};

function getSelectionHelpText(
  picker: string,
  minDate: Dayjs | null,
  maxDate: Dayjs | null
): string {
  if (minDate !== null && maxDate !== null) {
    return dateRangeHelperText.minmax(
      minDate.format("ll"),
      maxDate.format("ll")
    );
  }
  switch (picker) {
    case "future":
    case "todayFuture":
      if (minDate !== null) {
        return dateRangeHelperText.min(minDate.format("ll"));
      }
      return "";
    case "past":
    case "todayPast":
      if (maxDate !== null) {
        return dateRangeHelperText.max(maxDate.format("ll"));
      }
      return "";
    default:
      return "";
  }
}

export const DateRangeFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const theme = useTheme();
  const [refresh, doRefreshMeta] = useState(Date.now()); // to refresh meta content when picker is opened
  const [value, setValue] = useState<[Dayjs | null, Dayjs | null] | null>(
    () => {
      const _val: [Dayjs | null, Dayjs | null] = [null, null];
      const initialValue = kristaTypeField.getKristaValue().getValue();
      if (initialValue) {
        if (initialValue["from"]) {
          _val[0] = timestampToAgnosticDate(
            initialValue["from"],
            kristaTypeField.attributes.get("timezone")
          );
        }
        if (initialValue["to"]) {
          _val[1] = timestampToAgnosticDate(
            initialValue["to"],
            kristaTypeField.attributes.get("timezone")
          );
        }
      }
      return _val;
    }
  );
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const {
    defaultFormat,
    timezone,
    minDate,
    maxDate,
    helpText,
    maxDurationInDays,
    tooltip,
  } = useMemo(() => {
    const _defaultFormat = "ll";
    const allowedRange = kristaTypeField.attributes.get("allowedRange");
    const _timezone = kristaTypeField.attributes.get("timezone");
    const _maxDurationInDays = kristaTypeField.attributes.get("maxDurationInDays");
    const _startOfToday = timestampToAgnosticDate(
      Date.now(),
      _timezone
    ).startOf("day");
    const _endOfToday = timestampToAgnosticDate(Date.now(), _timezone).endOf(
      "day"
    );
    const _startOfTomorrow = _startOfToday.add(1, "day");
    const _endOfYesterday = _endOfToday.add(-1, "day");
    const _picker = (mapper as any)[
      `${kristaTypeField.attributes.get("allowPast") ? 1 : 0}${
        kristaTypeField.attributes.get("allowToday") ? 1 : 0
      }${kristaTypeField.attributes.get("allowFuture") ? 1 : 0}`
    ];
    let _minDate: Dayjs | null | "impossible" = null;
    if (allowedRange && allowedRange.from) {
      _minDate = timestampToAgnosticDate(allowedRange.from, _timezone);
    }
    let _maxDate: Dayjs | null | "impossible" = null;
    if (allowedRange && allowedRange.to) {
      _maxDate = timestampToAgnosticDate(allowedRange.to, _timezone);
    }
    if (!_minDate) {
      if (_picker === "todayFuture" || _picker === "today") {
        _minDate = dayjs(_startOfToday);
      } else if (_picker === "future") {
        _minDate = dayjs(_startOfTomorrow);
      }
    } else {
      switch (_picker) {
        case "todayFuture":
        case "today":
          if ((_minDate as Dayjs).isBefore(_startOfToday)) {
            _minDate = _startOfToday;
          }
          break;
        case "future":
          if ((_minDate as Dayjs).isBefore(_startOfTomorrow)) {
            _minDate = _startOfTomorrow;
          }
          break;
        case "todayPast":
          if ((_minDate as Dayjs).isAfter(_endOfToday)) {
            _minDate = "impossible";
          }
          break;
        case "past":
          if ((_minDate as Dayjs).isAfter(_startOfToday)) {
            _minDate = "impossible";
          }
          break;
        default:
          break;
      }
    }
    if (!_maxDate) {
      if (_picker === "todayPast" || _picker === "today") {
        _maxDate = dayjs(_endOfToday);
      } else if (_picker === "past") {
        _maxDate = dayjs(_endOfYesterday);
      }
    } else {
      switch (_picker) {
        case "todayFuture":
          if ((_maxDate as Dayjs).isBefore(_startOfToday)) {
            _maxDate = "impossible";
          }
          break;
        case "future":
          if ((_maxDate as Dayjs).isBefore(_endOfToday)) {
            _maxDate = "impossible";
          }
          break;
        case "todayPast":
        case "today":
          if ((_maxDate as Dayjs).isAfter(_endOfToday)) {
            _maxDate = _endOfToday;
          }
          break;
        case "past":
          if ((_maxDate as Dayjs).isAfter(_endOfYesterday)) {
            _maxDate = _endOfYesterday;
          }
          break;
        default:
          break;
      }
    }
    if (_minDate !== "impossible" && _maxDate !== "impossible") {
      if (_minDate && _maxDate && _maxDate.isBefore(_minDate)) {
        _minDate = "impossible";
        _maxDate = "impossible";
      }
    }
    let _helpText: string = "";
    if (_minDate !== "impossible" && _maxDate !== "impossible") {
      _helpText = getSelectionHelpText(_picker, _minDate, _maxDate);
    } else {
      _helpText = i18next.t("krista.dateRange.rulesConflict");
    }
    return {
      tooltip: kristaTypeField.attributes.toolTip,
      defaultFormat: _defaultFormat,
      timezone: _timezone,
      minDate: _minDate,
      maxDate: _maxDate,
      helpText: _helpText,
      maxDurationInDays: _maxDurationInDays
        ? dateRangeHelperText.maxDays(_maxDurationInDays)
        : "",
    };
  }, [refresh]);

  const onChange = (newValue: [Dayjs | null, Dayjs | null] | null) => {
    setValue(newValue);
    if (newValue && newValue[0] && newValue[1]) {
      const _from = datePlus.stripTime(newValue[0]);
      const _to = datePlus.stripTime(newValue[1]);
      const range = new TypeDateRange(_from.valueOf(), _to.valueOf());
      kristaTypeField.setValue(range.toJSON());
    } else {
      kristaTypeField.setValue(undefined);
    }
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
    if (!minDate && !maxDate) {
      return false;
    }
    if (minDate && maxDate) {
      if (minDate === "impossible" || maxDate === "impossible") {
        return true;
      }
      if (minDate.isAfter(maxDate)) {
        return true;
      }
      return (
        current.isBefore(minDate, "day") || current.isAfter(maxDate, "day")
      );
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
      <RangePicker
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
        placeholder={[
          !(kristaTypeField.readOnly || options.readOnly)
            ? t("placeholder.select", { fieldName: kristaTypeField.label })
            : "",
          !(kristaTypeField.readOnly || options.readOnly)
            ? t("placeholder.select", { fieldName: kristaTypeField.label })
            : "",
        ]}
        showNow={false}
        showTime={false}
        use12Hours
        onOpenChange={(open: boolean) => {
          if (open) {
            doRefreshMeta(Date.now());
          }
        }}
        renderExtraFooter={() => (
          <div>
            <div>{helpText}</div>
            <div>{maxDurationInDays}</div>
          </div>
        )}
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

DateRangeFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.DATE_RANGE_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
