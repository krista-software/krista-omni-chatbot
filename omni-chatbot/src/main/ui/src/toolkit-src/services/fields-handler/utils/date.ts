import dayjs, { Dayjs } from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import isToday from "dayjs/plugin/isToday";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import calendar from "dayjs/plugin/calendar";
import updateLocale from "dayjs/plugin/updateLocale";
import "dayjs/locale/de";
import "dayjs/locale/fr";
import "dayjs/locale/es";
import "dayjs/locale/en";
import "dayjs/locale/hi";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(isToday);
dayjs.extend(calendar);
dayjs.extend(updateLocale);

function formatDate(this: Dayjs) {
  if (dayjs().isSame(this, "year")) {
    return this.format("M/D hh:mm a");
  }
  return this.format("M/D/YY hh:mm a");
}

const standardCalenderFormat = {
  lastDay: formatDate,
  sameDay: "hh:mm a",
  nextDay: formatDate,
  lastWeek: formatDate,
  nextWeek: formatDate,
  sameElse: formatDate,
};

dayjs.updateLocale("en", {
  calendar: standardCalenderFormat,
});

dayjs.updateLocale("mr", {
  calendar: standardCalenderFormat,
});

dayjs.updateLocale("hi", {
  calendar: standardCalenderFormat,
});

dayjs.updateLocale("fr", {
  calendar: standardCalenderFormat,
});

dayjs.updateLocale("es", {
  calendar: standardCalenderFormat,
});

dayjs.updateLocale("de", {
  calendar: standardCalenderFormat,
});

export const datePlus = {
  toTime(date: number): string {
    return dayjs(date).format("LT").toLowerCase();
  },
  toExactTime(date: number): string {
    return dayjs(date).format("llll");
  },
  fullDateTime(date: number): string {
    return dayjs(date).format("ddd, D MMM YYYY h:mm:ss a");
  },
  stripTime(date: Dayjs): Dayjs {
    return date.hour(0).minute(0).second(0).millisecond(0);
  },
  stripSeconds(date: Dayjs): Dayjs {
    return date.second(0).millisecond(0);
  },
  stripMilliSeconds(date: Dayjs): Dayjs {
    return date.millisecond(0);
  },
  calendarTime(date: number): string {
    return dayjs(date).calendar();
  },
};
