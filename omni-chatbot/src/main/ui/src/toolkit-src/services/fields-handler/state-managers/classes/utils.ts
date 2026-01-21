import dayjs from "dayjs";
import { GenericObject } from "../types";
import { FieldTypes } from "../FieldTypes";

export function createMap(mapJson: GenericObject): Map<string, any> {
  const map: Map<string, any> = new Map<string, any>();
  if (mapJson) {
    Object.keys(mapJson).forEach((key) => {
      map.set(key, (mapJson as any)[key]);
    });
  }
  return map;
}

export function fieldType(logicalName: string): FieldTypes {
  const splits = logicalName ? logicalName.split(".") : [];
  return (
    splits.length > 0 ? splits[splits.length - 1] : logicalName
  ) as FieldTypes;
}

export function timestampToAgnosticDate(value: number, timezone?: string) {
  const offset = dayjs(value).utcOffset();
  let timezoneOffset = 0;
  if (timezone) {
    timezoneOffset = dayjs(value).tz(timezone).utcOffset() * -1;
  }
  return timezone
    ? dayjs(value).add((timezoneOffset + offset) * -1, "minute")
    : dayjs(value);
}

export function correctDateToUTCStart(
  value: number,
  includeTime: boolean,
  timezone?: string
) {
  if (timezone) {
    return dayjs.tz(value, timezone);
  }
  return includeTime
    ? dayjs(value)
    : dayjs(value).add(dayjs(value).utcOffset() * -1, "minute");
}

export function arrayEquals(a: any[], b: any[]) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index])
  );
}
