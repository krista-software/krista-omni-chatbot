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
  "010": "now",
  "011": "nowFuture",
  "100": "past",
  "101": "all",
  "110": "nowPast",
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
      minDate.format("lll"),
      maxDate.format("lll")
    );
  }
  switch (picker) {
    case "future":
    case "nowFuture":
      if (minDate !== null) {
        return dateRangeHelperText.min(minDate.format("lll"));
      }
      return "";
    case "past":
    case "nowPast":
      if (maxDate !== null) {
        return dateRangeHelperText.max(maxDate.format("lll"));
      }
      return "";
    default:
      return "";
  }
}

const range = (start: number, end: number): number[] => {
  const result: number[] = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
};

const disabledTimes = {
  disabledHours: () => range(0, 24),
  disabledMinutes: () => range(0, 60),
  disabledSeconds: () => range(0, 60),
};

export const DateTimeRangeFieldRenderer = (({ kristaTypeField, options = {} }) => {
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
    maxDurationInHours,
    tooltip,
  } = useMemo(() => {
    const _defaultFormat = "lll";
    const _maxDurationInHours = kristaTypeField.attributes.get("maxDurationInHours");
    const allowedRange = kristaTypeField.attributes.get("allowedRange");
    const _timezone = kristaTypeField.attributes.get("timezone");
    const _now = timestampToAgnosticDate(Date.now(), _timezone);
    const _picker = (mapper as any)[
      `${kristaTypeField.attributes.get("allowPast") ? 1 : 0}${
        kristaTypeField.attributes.get("allowNow") ? 1 : 0
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
      if (
        _picker === "future" ||
        _picker === "nowFuture" ||
        _picker === "now"
      ) {
        _minDate = dayjs(_now);
      }
    } else {
      switch (_picker) {
        case "future":
        case "nowFuture":
          if ((_minDate as Dayjs).isBefore(_now)) {
            _minDate = _now;
          }
          break;
        case "now":
          if ((_minDate as Dayjs).isBefore(_now)) {
            _minDate = _now;
          } else if ((_minDate as Dayjs).isAfter(_now)) {
            _minDate = "impossible";
          }
          break;
        case "past":
        case "nowPast":
          if ((_minDate as Dayjs).isAfter(_now)) {
            _minDate = "impossible";
          }
          break;
        default:
          break;
      }
    }
    if (!_maxDate) {
      if (_picker === "past" || _picker === "now" || _picker === "nowPast") {
        _maxDate = dayjs(_now);
      }
    } else {
      switch (_picker) {
        case "future":
        case "nowFuture":
          if ((_maxDate as Dayjs).isBefore(_now)) {
            _maxDate = "impossible";
          }
          break;
        case "now":
          if ((_maxDate as Dayjs).isBefore(_now)) {
            _maxDate = "impossible";
          } else if ((_maxDate as Dayjs).isAfter(_now)) {
            _maxDate = _now;
          }
          break;
        case "past":
        case "nowPast":
          if ((_maxDate as Dayjs).isAfter(_now)) {
            _maxDate = _now;
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
      maxDurationInHours: _maxDurationInHours
        ? dateRangeHelperText.maxHours(_maxDurationInHours)
        : "",
    };
  }, [refresh]);

  const onChange = (newValue: [Dayjs | null, Dayjs | null] | null) => {
    if (newValue && newValue[0] && newValue[1]) {
      if (minDate && minDate !== "impossible") {
        if (newValue[0].isBefore(minDate)) {
          newValue[0] = minDate;
        }
        if (newValue[1].isBefore(minDate)) {
          newValue[1] = minDate;
        }
      }
      if (maxDate && maxDate !== "impossible") {
        if (newValue[0].isAfter(maxDate)) {
          newValue[0] = maxDate;
        }
        if (newValue[1].isAfter(maxDate)) {
          newValue[1] = maxDate;
        }
      }
      if (newValue[0] > newValue[1]) {
        const temp = newValue[0];
        newValue[0] = newValue[1];
        newValue[1] = temp;
      }
    }
    setValue(newValue);
    if (newValue && newValue[0] && newValue[1]) {
      const _from = datePlus.stripMilliSeconds(newValue[0]);
      const _to = datePlus.stripMilliSeconds(newValue[1]);
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

  const disabledTime = () => {
    if (minDate === "impossible" || maxDate === "impossible") {
      return disabledTimes;
    }
    return {
      disabledHours: () => [],
      disabledMinutes: () => [],
      disabledSeconds: () => [],
    };
  };

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
        disabledTime={disabledTime}
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
        showTime={{
          use12Hours: true,
        }}
        onOpenChange={(open: boolean) => {
          if (open) {
            doRefreshMeta(Date.now());
          }
        }}
        renderExtraFooter={() => (
          <div>
            <div>{helpText}</div>
            <div>{maxDurationInHours}</div>
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

DateTimeRangeFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.DATE_TIME_RANGE_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
