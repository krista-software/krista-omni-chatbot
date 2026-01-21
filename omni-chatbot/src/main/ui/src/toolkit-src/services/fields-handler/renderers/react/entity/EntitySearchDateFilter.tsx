import React, { useEffect, useState } from "react";
import dayjsGenerateConfig from "rc-picker/lib/generate/dayjs";
import Picker from "rc-picker";
import { useTheme } from "@mui/material/styles";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import enUS from "rc-picker/lib/locale/en_US";
import esES from "rc-picker/lib/locale/es_ES";
import frFR from "rc-picker/lib/locale/fr_FR";
import deDE from "rc-picker/lib/locale/de_DE";
import hiIN from "rc-picker/lib/locale/hi_IN";
import { Locale } from "rc-picker/lib/interface";
import { Box } from "@mui/material";
import Stack from "@mui/material/Stack";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import CalendarIcon from "@mui/icons-material/Event";
import dayjs, { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { datePlus } from "../../../utils/date";
import { EntitySearchValue } from "../entity/EntitySearchModal";
import { timestampToAgnosticDate } from "../../../state-managers/classes/utils";

interface FilterProps {
  value: Dayjs | null;
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

export function EntitySearchDateFilter({ value, onChange }: FilterProps) {
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

  const onDateChange = (newValue: Dayjs | null) => {
    if (newValue === null) {
      onChange(null);
      return;
    }
    onChange({
      payload: `${datePlus.stripTime(newValue).valueOf()}`,
      value: datePlus.stripTime(newValue),
    });
    setOpen(false);
  };

  const sharedProps = {
    generateConfig: {
      ...dayjsGenerateConfig,
      getNow: () => timestampToAgnosticDate(Date.now()),
    },
    value: value ? dayjs(value) : null,
    onChange: onDateChange,
  };

  useEffect(() => {
    setFormattedValue(value === null ? "" : value.format("ll"));
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
          <Picker
            open={open}
            {...sharedProps}
            picker="date"
            className={`${theme?.palette.mode}-mode`}
            dropdownClassName={`entity-selection-filter ${theme?.palette.mode}-mode`}
            locale={locales[dayjs.locale()] || enUS}
          />
        </Box>
      </Stack>
    </ClickAwayListener>
  );
}
