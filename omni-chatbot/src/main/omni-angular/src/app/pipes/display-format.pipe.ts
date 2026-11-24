import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe for formatting boolean values to Yes/No display.
 *
 * Usage: {{ value | booleanDisplay }}
 * Example: {{ true | booleanDisplay }} => "Yes"
 */
@Pipe({
  name: 'booleanDisplay',
  standalone: false,
  pure: true
})
export class BooleanDisplayPipe implements PipeTransform {
  transform(
    value: boolean | null | undefined,
    trueText: string = 'Yes',
    falseText: string = 'No'
  ): string {
    if (value === null || value === undefined) {
      return falseText;
    }
    return value ? trueText : falseText;
  }
}

/**
 * Pure pipe for formatting rating values to star display.
 *
 * Usage: {{ rating | ratingDisplay }}
 * Example: {{ 3 | ratingDisplay }} => "★★★"
 */
@Pipe({
  name: 'ratingDisplay',
  standalone: false,
  pure: true
})
export class RatingDisplayPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    maxRating: number = 5,
    filledStar: string = '★',
    emptyStar: string = '☆'
  ): string {
    if (value === null || value === undefined || value < 0) {
      return emptyStar.repeat(maxRating);
    }

    const rating = Math.min(Math.round(value), maxRating);
    const filled = filledStar.repeat(rating);
    const empty = emptyStar.repeat(maxRating - rating);

    return filled + empty;
  }
}

/**
 * Pure pipe for truncating text with ellipsis.
 *
 * Usage: {{ text | truncate:50 }}
 * Example: {{ 'Long text...' | truncate:10 }} => "Long te..."
 */
@Pipe({
  name: 'truncate',
  standalone: false,
  pure: true
})
export class TruncatePipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    maxLength: number = 100,
    suffix: string = '...'
  ): string {
    if (!value) {
      return '';
    }

    if (value.length <= maxLength) {
      return value;
    }

    return value.substring(0, maxLength - suffix.length) + suffix;
  }
}

/**
 * Pure pipe for formatting percentage values.
 *
 * Usage: {{ value | percentageDisplay }}
 * Example: {{ 0.23 | percentageDisplay }} => "23%"
 * Example: {{ 23 | percentageDisplay:false }} => "23%"
 */
@Pipe({
  name: 'percentageDisplay',
  standalone: false,
  pure: true
})
export class PercentageDisplayPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    isDecimal: boolean = true,
    decimals: number = 0
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    let numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return '';
    }

    // If the value is a decimal (e.g., 0.23), multiply by 100
    if (isDecimal && numValue >= -1 && numValue <= 1) {
      numValue = numValue * 100;
    }

    return `${numValue.toFixed(decimals)}%`;
  }
}

/**
 * Pure pipe for formatting currency values.
 *
 * Usage: {{ value | currencyDisplay }}
 * Example: {{ 1234.56 | currencyDisplay }} => "$1,234.56"
 */
@Pipe({
  name: 'currencyDisplay',
  standalone: false,
  pure: true
})
export class CurrencyDisplayPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    currencySymbol: string = '$',
    decimals: number = 2,
    locale: string = 'en-US'
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return '';
    }

    const formatted = numValue.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    return `${currencySymbol}${formatted}`;
  }
}

