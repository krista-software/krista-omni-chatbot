import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe for formatting timestamps to short time format (HH:MM).
 *
 * Usage: {{ timestamp | timeFormat }}
 * Example: {{ 1701432000000 | timeFormat }} => "10:00 AM"
 */
@Pipe({
  name: 'timeFormat',
  standalone: false,
  pure: true
})
export class TimeFormatPipe implements PipeTransform {
  transform(timestamp: number | Date | null | undefined): string {
    if (timestamp === null || timestamp === undefined) {
      return '';
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Pure pipe for formatting timestamps to full date/time format.
 * Format: "ddd, D MMM YYYY h:mm:ss a" (e.g., "Mon, 1 Dec 2025 3:45:30 pm")
 *
 * Usage: {{ timestamp | fullDateTime }}
 * Example: {{ 1701432000000 | fullDateTime }} => "Fri, 1 Dec 2023 10:00:00 AM"
 */
@Pipe({
  name: 'fullDateTime',
  standalone: false,
  pure: true
})
export class FullDateTimePipe implements PipeTransform {
  transform(timestamp: number | Date | null | undefined): string {
    if (timestamp === null || timestamp === undefined) {
      return '';
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return '';
    }

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };

    return date.toLocaleString(undefined, options);
  }
}

/**
 * Pure pipe for formatting timestamps to date only format.
 *
 * Usage: {{ timestamp | dateFormat }}
 * Example: {{ 1701432000000 | dateFormat }} => "12/1/2023"
 */
@Pipe({
  name: 'dateFormat',
  standalone: false,
  pure: true
})
export class DateFormatPipe implements PipeTransform {
  transform(timestamp: number | Date | null | undefined, format?: string): string {
    if (timestamp === null || timestamp === undefined) {
      return '';
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString();
  }
}

