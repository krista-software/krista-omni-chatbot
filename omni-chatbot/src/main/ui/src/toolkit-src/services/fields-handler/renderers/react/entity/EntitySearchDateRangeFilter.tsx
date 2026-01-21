import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import CalendarIcon from "@mui/icons-material/Event";
import dayjs, { Dayjs } from "dayjs";
import { RangePicker } from "rc-picker";
import dayjsGenerateConfig from "rc-picker/lib/generate/dayjs";
import enUS from "rc-picker/lib/locale/en_US";
import esES from "rc-picker/lib/locale/es_ES";
import frFR from "rc-picker/lib/locale/fr_FR";
import deDE from "rc-picker/lib/locale/de_DE";
import hiIN from "rc-picker/lib/locale/hi_IN";
import { Locale } from "rc-picker/lib/interface";
import { RangeValue } from "rc-picker/lib/interface";
import { useTranslation } from "react-i18next";
import { datePlus } from "../../../utils/date";
import { EntitySearchValue } from "../entity/EntitySearchModal";
import { timestampToAgnosticDate } from "../../../state-managers/classes/utils";

type DateRange<TDate> = [TDate | null, TDate | null];

interface FilterProps {
  value: DateRange<Dayjs> | null;
  onChange: (value: EntitySearchValue) => void;
}

const locales: { [key: string]: Locale } = {
  en: enUS,
  fr: frFR,
  es: esES,
  de: deDE,
  hi: hiIN,
  mr: hiIN,
};

export function EntitySearchDateRangeFilter({ value, onChange }: FilterProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [formattedValue, setFormattedValue] = useState("");

  const openCalendar = () => {
    setOpen((prev) => !prev);
  };

  const handleClickAway = () => {
    setOpen(false);
  };

  const onDateChange = (newValue: [Dayjs | null, Dayjs | null] | null) => {
    if (newValue) {
      if (newValue[0] === null || newValue[1] === null) {
        setFormattedValue("");
        onChange(null);
        return;
      }
      const fromDate = datePlus.stripTime(newValue[0]);
      const toDate = datePlus.stripTime(newValue[1]);
      onChange({
        payload: `${fromDate.valueOf()},${toDate.valueOf()}`,
        value: [fromDate, toDate],
      });
      setFormattedValue(
        `${newValue[0].format("ll")} to ${newValue[1].format("ll")}`
      );
    }
  };

  const rangeValue: RangeValue<Dayjs> = value
    ? [value[0] ? dayjs(value[0]) : null, value[1] ? dayjs(value[1]) : null]
    : null;
  const sharedProps = {
    generateConfig: {
      ...dayjsGenerateConfig,
      getNow: () => timestampToAgnosticDate(Date.now()),
    },
    value: rangeValue,
    onChange: onDateChange,
  };

  useEffect(() => {
    if (value) {
      if (value[0] === null || value[1] === null) {
        setFormattedValue("");
      } else {
        setFormattedValue(
          `${value[0].format("ll")} to ${value[1].format("ll")}`
        );
      }
    } else {
      setFormattedValue("");
    }
  }, [value]);

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Stack direction="row" sx={{ flex: "1 0", position: "relative" }}>
        <IconButton onClick={openCalendar} size="small">
          <CalendarIcon fontSize="inherit" />
        </IconButton>
        <InputBase
          onClick={openCalendar}
          value={formattedValue}
          placeholder={t("krista.general.search")}
          sx={{ flex: "1 0", ml: 0.5 }}
        />
        <Box sx={{ position: "absolute", visibility: "hidden" }}>
          <RangePicker
            {...sharedProps}
            open={open}
            picker="date"
            format="ll"
            className={`${theme?.palette.mode}-mode`}
            dropdownClassName={`entity-selection-filter ${theme?.palette.mode}-mode`}
            locale={locales[dayjs.locale()] || enUS}
          />
        </Box>
      </Stack>
    </ClickAwayListener>
  );
}
