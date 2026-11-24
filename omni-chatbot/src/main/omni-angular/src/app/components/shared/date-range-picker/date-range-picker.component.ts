import { Component, Inject, OnInit, ElementRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import moment from 'moment';
import { Moment } from 'moment';
import { Day } from '../../../models/day.model';
import { ThemeService } from '../../../services/theme.service';

/**
 * Data passed to the DateRangePickerComponent dialog
 */
export interface DateRangePickerData {
    minDate?: Moment;
    maxDate?: Moment;
    today?: Moment;
    startDate?: Moment;
    endDate?: Moment;
    date?: Moment;
    defaultTimeSpan?: number;
    maxDaysSelection?: number;
    maxHourSelection?: number;
    range?: boolean;
    label?: string;
    allowToday?: boolean;
    allowNow?: boolean;
    allowTime?: boolean;
}

/**
 * Result returned from the DateRangePickerComponent dialog
 */
export interface DateRangePickerResult {
    action: 'save' | 'cancel';
    startDate?: Moment;
    endDate?: Moment;
    date?: Moment;
}

/**
 * Custom modal date picker component that handles single date, date range, and date-time range selection.
 * Based on kristaclient's DateRangePickerComponent implementation.
 */
@Component({
    selector: 'app-date-range-picker',
    templateUrl: './date-range-picker.component.html',
    styleUrls: ['./date-range-picker.component.scss'],
    standalone: false
})
export class DateRangePickerComponent implements OnInit {
    // Input properties from dialog data
    minDate: Moment | null = null;
    maxDate: Moment | null = null;
    today: Moment | null = null;
    startDate: Moment | null = null;
    endDate: Moment | null = null;
    date: Moment | null = null;
    defaultTimeSpan: number | null = null;
    maxDaysSelection: number | null = null;
    maxHourSelection: number | null = null;
    range = false;
    label = 'Date';
    allowToday = true;
    allowNow = true;
    allowTime = false;

    // Component state
    selectionHintMessage = '';
    minTime: string | null = null;
    maxTime: string | null = null;
    timeSelection: string | null = null;
    months: string[] = [];
    allMonths: string[] = moment().localeData().months();
    years: number[] = [];
    weeks: (Day | null)[][] = [];
    mmt = moment;
    displayedMonth!: Moment;
    initialYear!: number;
    showMonthSelection = false;
    showYearSelection = false;
    selectedMonth!: string;
    selectedYear!: number;

    private selecting = false;
    private readonly TIME_FORMAT = 'hh:mm A';

    constructor(
        private dialogRef: MatDialogRef<DateRangePickerComponent>,
        @Inject(MAT_DIALOG_DATA) public data: DateRangePickerData,
        private elementRef: ElementRef,
        private themeService: ThemeService
    ) {
        // Initialize from dialog data
        this.minDate = data.minDate || null;
        this.maxDate = data.maxDate || null;
        this.today = data.today || moment();
        this.startDate = data.startDate || null;
        this.endDate = data.endDate || null;
        this.date = data.date || null;
        this.defaultTimeSpan = data.defaultTimeSpan || null;
        this.maxDaysSelection = data.maxDaysSelection || null;
        this.maxHourSelection = data.maxHourSelection || null;
        this.range = data.range || false;
        this.label = data.label || 'Date';
        this.allowToday = data.allowToday !== false;
        this.allowNow = data.allowNow !== false;
        this.allowTime = data.allowTime || false;
    }

    ngOnInit(): void {
        this.applyThemeColors();
        this.initSetting();
        this.populate();
        this.years = this.getYears();
        this.months = this.getMonths();
        this.initialYear = this.getCurrentSelectionYear();
        this.getHintMessage();
    }

    /**
     * Apply theme colors from config to CSS variables
     * Uses brandColor from theme config, falls back to orange if not available
     */
    private applyThemeColors(): void {
        const primaryColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--krista-primary').trim();

        // Use theme primary color if available, otherwise fall back to default orange
        const themeColor = primaryColor || '#F6AF1E';

        // Apply to component's host element
        const hostElement = this.elementRef.nativeElement;
        hostElement.style.setProperty('--kr-color-secondary', themeColor);

        // Calculate darker shade for hover (reduce lightness by ~10%)
        const darkerColor = this.adjustColorBrightness(themeColor, -10);
        hostElement.style.setProperty('--kr-color-secondary-dark', darkerColor);

        // Calculate lighter shade for range background (visible tint of theme color)
        // Using very light tint for subtle background band
        const lighterColor = this.createLightTint(themeColor, 0.12); // 12% opacity effect
        hostElement.style.setProperty('--kr-color-secondary-light', lighterColor);

        // Calculate slightly darker tint for gradient edges (start/end date cells)
        const lighterHoverColor = this.createLightTint(themeColor, 0.12); // 18% opacity effect
        hostElement.style.setProperty('--kr-color-secondary-light-hover', lighterHoverColor);
    }

    /**
     * Create a light tint by blending the color with white
     * This creates a more natural-looking light shade than just adjusting lightness
     * @param color Hex color string
     * @param opacity Opacity of the original color (0-1), lower = lighter tint
     */
    private createLightTint(color: string, opacity: number): string {
        // Remove # if present
        const hex = color.replace('#', '');

        // Convert hex to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Blend with white (255, 255, 255)
        const tintR = Math.round(r * opacity + 255 * (1 - opacity));
        const tintG = Math.round(g * opacity + 255 * (1 - opacity));
        const tintB = Math.round(b * opacity + 255 * (1 - opacity));

        // Convert to hex
        const toHex = (n: number) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return '#' + toHex(tintR) + toHex(tintG) + toHex(tintB);
    }

    /**
     * Adjust color brightness by converting to HSL and modifying lightness
     * @param color Hex color string
     * @param percent Percentage to adjust lightness (-100 to 100)
     */
    private adjustColorBrightness(color: string, percent: number): string {
        // Remove # if present
        const hex = color.replace('#', '');

        // Convert hex to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Convert RGB to HSL
        const hsl = this.rgbToHsl(r, g, b);

        // Adjust lightness
        hsl[2] = Math.max(0, Math.min(100, hsl[2] + percent));

        // Convert back to RGB
        const rgb = this.hslToRgb(hsl[0], hsl[1], hsl[2]);

        // Convert to hex
        return '#' + rgb.map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return [h * 360, s * 100, l * 100];
    }

    private hslToRgb(h: number, s: number, l: number): [number, number, number] {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [r * 255, g * 255, b * 255];
    }

    private initSetting(): void {
        let refDate: Moment;
        if (this.range) {
            refDate = moment(this.endDate || this.startDate || this.today || moment());
        } else {
            refDate = moment(this.date || this.today || moment());
        }
        this.displayedMonth = refDate;
        this.setSelectedMonthAndYear();
        if (this.allowTime) {
            this.correctRangeTimeSettingSelection(refDate, this.startDate ?? undefined);
            this.correctDateTime(refDate);
            this.timeSelection = this.getSelectedTimeString(refDate);
        }
    }

    getSelectedTimeString(d: Moment): string {
        d.locale('en');
        const timeSelection = d.format(this.TIME_FORMAT);
        d.locale(moment.locale());
        return timeSelection;
    }

    private correctRangeTimeSettingSelection(refDate: Moment, startDate?: Moment): void {
        if (!this.allowTime) {
            return;
        }
        this.minTime = this.getPossibleMinimumTime(refDate);
        this.maxTime = this.getPossibleMaximumTime(refDate, startDate);
    }

    setSelectedMonthAndYear(): void {
        this.selectedMonth = this.displayedMonth.format('MMMM');
        this.selectedYear = this.getCurrentSelectionYear();
    }

    getPossibleMinimumTime(refDate: Moment): string | null {
        if (this.minDate && this.minDate.isSame(refDate, 'day')) {
            return this.minDate.format(this.TIME_FORMAT);
        }
        return null;
    }

    toggleMonths(): void {
        this.showYearSelection = false;
        this.showMonthSelection = !this.showMonthSelection;

        // Scroll to selected month after view updates
        if (this.showMonthSelection) {
            setTimeout(() => this.scrollToSelectedMonth(), 0);
        }
    }

    toggleYears(): void {
        this.showMonthSelection = false;
        this.showYearSelection = !this.showYearSelection;

        // Scroll to selected year after view updates
        if (this.showYearSelection) {
            setTimeout(() => this.scrollToSelectedYear(), 0);
        }
    }

    private scrollToSelectedMonth(): void {
        const monthDropdown = this.elementRef.nativeElement.querySelector('.month-dropdown');
        const selectedItem = this.elementRef.nativeElement.querySelector('.month-dropdown .dropdown-item.selected');

        if (monthDropdown && selectedItem) {
            const dropdownRect = monthDropdown.getBoundingClientRect();
            const itemRect = selectedItem.getBoundingClientRect();
            const scrollTop = itemRect.top - dropdownRect.top - (dropdownRect.height / 2) + (itemRect.height / 2);
            monthDropdown.scrollTop = scrollTop;
        }
    }

    private scrollToSelectedYear(): void {
        const yearDropdown = this.elementRef.nativeElement.querySelector('.year-dropdown');
        const selectedItem = this.elementRef.nativeElement.querySelector('.year-dropdown .year-item.selected');

        if (yearDropdown && selectedItem) {
            const dropdownRect = yearDropdown.getBoundingClientRect();
            const itemRect = selectedItem.getBoundingClientRect();
            const scrollTop = itemRect.top - dropdownRect.top - (dropdownRect.height / 2) + (itemRect.height / 2);
            yearDropdown.scrollTop = scrollTop;
        }
    }

    closeMonthsAndYears(): void {
        this.showYearSelection = false;
        this.showMonthSelection = false;
    }

    private getPossibleMaximumTime(refDate: Moment, startDate?: Moment): string | null {
        let maxTime: string | null = null;
        let maxAllowedFromStart: Moment | null = null;
        if (startDate && this.maxHourSelection) {
            maxAllowedFromStart = moment(startDate.valueOf()).add(this.maxHourSelection, 'hours');
            if (maxAllowedFromStart.isSame(refDate, 'day')) {
                maxTime = maxAllowedFromStart.format(this.TIME_FORMAT);
            }
        }
        if (this.maxDate && this.maxDate.isSame(refDate, 'day')) {
            const maxAllowed = maxAllowedFromStart
                ? maxAllowedFromStart.isAfter(this.maxDate)
                    ? this.maxDate : maxAllowedFromStart : this.maxDate;
            maxTime = maxAllowed.format(this.TIME_FORMAT);
        }
        return maxTime;
    }

    private correctDateTime(refDate: Moment, startDate?: Moment): void {
        if (this.range && this.allowTime) {
            const minTime = this.getPossibleMinimumTime(refDate);
            const maxTime = this.getPossibleMaximumTime(refDate, startDate);
            const time = refDate.format(this.TIME_FORMAT);
            if (time && minTime) {
                const min = moment(minTime, this.TIME_FORMAT);
                const selection = moment(time, this.TIME_FORMAT);
                if (selection.isBefore(min)) {
                    this.setTime(refDate, minTime);
                }
            }
            if (time && maxTime) {
                const max = moment(maxTime, this.TIME_FORMAT);
                const selection = moment(time, this.TIME_FORMAT);
                if (selection.isAfter(max)) {
                    this.setTime(refDate, maxTime);
                }
            }
        }
    }

    getDateSelectionString(): string {
        if (this.range) {
            let displayString = '';
            if (this.startDate) {
                displayString = this.startDate.format(this.allowTime ? 'lll' : 'll');
            }
            if (displayString && this.endDate) {
                displayString = displayString + ' - ' + this.endDate.format(this.allowTime ? 'lll' : 'll');
            }
            return displayString;
        } else {
            if (this.date) {
                return this.date.format(this.allowTime ? 'lll' : 'll');
            }
        }
        return '';
    }

    onSetTime(time: string): void {
        this.timeSelection = time;
        const applicableDate = !this.range ? this.date : this.selecting ? this.startDate : this.endDate;
        const applicableMoment = moment(applicableDate);
        this.setTime(applicableMoment, time);
        if (!this.range) {
            this.date = applicableMoment;
        } else if (this.selecting) {
            this.startDate = applicableMoment;
        } else {
            this.endDate = applicableMoment;
        }
        if (this.endDate) {
            this.correctDateTime(this.endDate, this.startDate ?? undefined);
        }
    }

    private getHintMessage(): void {
        if (this.minDate && this.maxDate) {
            this.selectionHintMessage = `Select a date between<br/>
                ${this.minDate.format(this.allowTime ? 'lll' : 'll')} - ${this.maxDate.format(this.allowTime ? 'lll' : 'll')}`;
        } else if (this.minDate) {
            this.selectionHintMessage = `Select a date after<br/>${this.minDate.format(this.allowTime ? 'lll' : 'll')}`;
        } else if (this.maxDate) {
            this.selectionHintMessage = `Select a date before<br/>${this.maxDate.format(this.allowTime ? 'lll' : 'll')}`;
        }
    }

    populate(): void {
        if (this.weeks.length === 0) {
            let week: (Day | null)[] = [];
            const weeks: (Day | null)[][] = [];
            const daysInMonth = this.displayedMonth.daysInMonth();
            const startOfMonth = moment(this.displayedMonth).set('date', 1);
            const offset = startOfMonth.day();
            week = week.concat(Array.from({ length: offset }, () => null));
            for (let i = 1; i <= daysInMonth; ++i) {
                const state = this.getDayState(i);
                week.push(new Day(i, state.selectedRange, state.startDate, state.endDate, state.selectDate, state.disabled, state.isToday));
                if ((i + offset) % 7 === 0 || i === daysInMonth) {
                    if (week.length < 7) {
                        week = week.concat(Array.from({ length: 7 - week.length }, () => null));
                    }
                    weeks.push(week);
                    week = [];
                }
            }
            this.weeks = [...weeks];
        } else {
            this.weeks.forEach((week) => {
                week.forEach((day) => {
                    if (day) {
                        const state = this.getDayState(day.date);
                        day.selectedRange = state.selectedRange;
                        day.startDate = state.startDate;
                        day.endDate = state.endDate;
                        day.selectDate = state.selectDate;
                        day.disabled = state.disabled;
                        day.isToday = state.isToday;
                    }
                });
            });
        }
        this.months = this.getMonths();
    }

    getCurrentSelectionYear(): number {
        this.displayedMonth.locale('en');
        const year = Number.parseInt(this.displayedMonth.format('YYYY'), 10);
        this.displayedMonth.locale(moment.locale());
        return year;
    }

    getYears(): number[] {
        const years: number[] = [];
        let startYear = 1900;
        let lastYear = 2100;
        if (this.minDate && this.maxDate) {
            startYear = Number.parseInt(this.minDate.format('YYYY'), 10);
            lastYear = Number.parseInt(this.maxDate.format('YYYY'), 10);
        } else if (this.minDate) {
            startYear = Number.parseInt(this.minDate.format('YYYY'), 10);
        } else if (this.maxDate) {
            lastYear = Number.parseInt(this.maxDate.format('YYYY'), 10);
        }
        for (let i = startYear; i <= lastYear; i++) {
            years.push(i);
        }
        return years;
    }

    getMonths(): string[] {
        let allowedMonths = this.allMonths;
        if (this.minDate && this.maxDate) {
            const minDateYear = Number.parseInt(this.minDate.format('YYYY'), 10);
            const maxDateYear = Number.parseInt(this.maxDate.format('YYYY'), 10);
            let startIndex: number;
            let endIndex: number;
            if (minDateYear === this.getCurrentSelectionYear() && maxDateYear === this.getCurrentSelectionYear()) {
                startIndex = this.allMonths.indexOf(this.minDate.format('MMMM'));
                endIndex = this.allMonths.indexOf(this.maxDate.format('MMMM'));
            } else {
                startIndex = minDateYear < this.getCurrentSelectionYear() ? 0 : this.allMonths.indexOf(this.minDate.format('MMMM'));
                endIndex = this.getCurrentSelectionYear() < maxDateYear ? 12 : this.allMonths.indexOf(this.maxDate.format('MMMM'));
            }
            allowedMonths = this.allMonths.slice(startIndex, endIndex + 1);
        } else if (this.minDate) {
            const currentMonth = this.minDate.format('MMMM');
            const minDateYear = Number.parseInt(this.minDate.format('YYYY'), 10);
            if (minDateYear === this.getCurrentSelectionYear()) {
                allowedMonths = this.allMonths.slice(this.allMonths.indexOf(currentMonth), this.allMonths.length);
            }
        } else if (this.maxDate) {
            const currentMonth = this.maxDate.format('MMMM');
            const maxDateYear = Number.parseInt(this.maxDate.format('YYYY'), 10);
            if (maxDateYear === this.getCurrentSelectionYear()) {
                allowedMonths = this.allMonths.slice(0, (this.allMonths.indexOf(currentMonth) + 1));
            }
        }
        return allowedMonths;
    }

    getDayState(date: number): { selectedRange: boolean; startDate: boolean; endDate: boolean; selectDate: boolean; disabled: boolean; isToday: boolean } {
        const day = moment(this.displayedMonth).set('date', date);
        return {
            selectedRange: this.isSelectedRange(day),
            startDate: this.isStartDate(day),
            endDate: this.isEndDate(day),
            selectDate: this.isSelectedDate(day),
            disabled: this.isDisabled(day),
            isToday: this.today ? day.isSame(this.today, 'day') : false,
        };
    }

    isStartDate(date: Moment): boolean {
        return !!(this.startDate && date.isSame(this.startDate, 'day'));
    }

    isEndDate(date: Moment): boolean {
        return !!(this.endDate && date.isSame(this.endDate, 'day'));
    }

    isSelectedDate(date: Moment): boolean {
        return !!(this.date && date.isSame(this.date, 'day'));
    }

    isSelectedRange(date: Moment): boolean {
        // Only apply selected-range to dates BETWEEN start and end (exclusive)
        // Start and end dates have their own classes (.start-date, .end-date)
        return !!(
            this.startDate &&
            this.endDate &&
            date.isAfter(this.startDate, 'day') &&
            date.isBefore(this.endDate, 'day')
        );
    }

    isDisabled(date: Moment): boolean {
        return !!(
            (this.minDate && date.isBefore(this.minDate, 'day')) ||
            (this.maxDate && date.isAfter(this.maxDate, 'day')) ||
            (!this.allowToday && this.today && date.isSame(this.today, 'day'))
        );
    }

    setStartDate(date: Moment): void {
        this.correctRangeTimeSettingSelection(date);
        this.selecting = true;
        this.correctDateTime(date);
        this.timeSelection = this.getSelectedTimeString(date);
        this.startDate = date;
        this.endDate = moment(date);
        this.correctDateTime(this.endDate, date);
        this.date = null;
        this.populate();
    }

    selectDate(day: Day): void {
        if (day && !day.disabled) {
            let date = moment(this.displayedMonth).set('date', day.date);
            if (this.range) {
                const timeSpan = this.defaultTimeSpan && this.defaultTimeSpan !== 0 ? this.defaultTimeSpan : 1;
                if (this.timeSelection) {
                    this.setTime(date, this.timeSelection);
                }
                if (this.selecting) {
                    if (date.isBefore(this.startDate, 'day')) {
                        this.setStartDate(date);
                        this.endDate = moment(date).add(timeSpan - 1, 'days');
                        this.populate();
                    } else {
                        if (this.maxDaysSelection) {
                            const selection = date.diff(this.startDate, 'days') + 1;
                            if (selection > this.maxDaysSelection) {
                                date = moment(this.startDate).add(this.maxDaysSelection - 1, 'days');
                            }
                        } else if (this.maxHourSelection) {
                            const selection = date.diff(this.startDate, 'hour') + 1;
                            if (selection > this.maxHourSelection) {
                                date = moment(this.startDate).add(this.maxHourSelection, 'hours');
                            }
                        }
                        this.correctRangeTimeSettingSelection(date, this.startDate ?? undefined);
                        this.selecting = false;
                        this.correctDateTime(date, this.startDate ?? undefined);
                        this.timeSelection = this.getSelectedTimeString(date);
                        this.endDate = date;
                        this.populate();
                    }
                } else {
                    this.setStartDate(date);
                    this.endDate = moment(date).add(timeSpan - 1, 'days');
                    this.populate();
                }
            } else {
                this.correctDateTime(date);
                this.date = date;
                this.startDate = null;
                this.endDate = null;
                this.correctRangeTimeSettingSelection(date);
                this.populate();
            }
        }
    }

    goToPreviousMonth(): void {
        this.displayedMonth = this.displayedMonth.subtract(1, 'months');
        this.setSelectedMonthAndYear();
        this.weeks = [];
        this.populate();
    }

    goToNextMonth(): void {
        this.displayedMonth = this.displayedMonth.add(1, 'months');
        this.setSelectedMonthAndYear();
        this.weeks = [];
        this.populate();
    }

    onMonthChange(m: string): void {
        this.showMonthSelection = false;
        this.displayedMonth = this.displayedMonth.set('month', this.allMonths.indexOf(m));
        this.setSelectedMonthAndYear();
        this.weeks = [];
        this.populate();
    }

    goToPreviousYear(): void {
        this.onYearChange(this.selectedYear - 1);
    }

    goToNextYear(): void {
        this.onYearChange(this.selectedYear + 1);
    }

    onYearChange(y: number): void {
        this.showYearSelection = false;
        this.displayedMonth = this.displayedMonth.set('year', y);
        this.months = this.getMonths();
        if (!this.months.includes(this.selectedMonth)) {
            this.displayedMonth = moment()
                .set('month', this.allMonths.indexOf(this.months[0]))
                .set('year', y);
        }
        this.setSelectedMonthAndYear();
        this.weeks = [];
        this.populate();
    }

    saveDates(): void {
        if (!this.allowTime) {
            if (this.startDate) {
                this.startDate.set('hour', 0).set('minute', 0).set('second', 0);
            }
            if (this.endDate) {
                this.endDate.set('hour', 0).set('minute', 0).set('second', 0);
            }
            if (this.date) {
                this.date.set('hour', 0).set('minute', 0).set('second', 0);
            }
        }
        this.dialogRef.close({
            action: 'save',
            startDate: this.startDate,
            endDate: this.endDate,
            date: this.date,
        } as DateRangePickerResult);
    }

    onCancel(): void {
        this.dialogRef.close({ action: 'cancel' } as DateRangePickerResult);
    }

    onRemove(): void {
        // Clear the selected dates but keep the modal open
        this.startDate = null;
        this.endDate = null;
        this.date = null;
        this.timeSelection = null;
        this.populate();
    }

    disableNextMonth(): boolean {
        return this.months.length === 0 ||
            (this.months[this.months.length - 1] === this.selectedMonth && this.years[this.years.length - 1] === this.getCurrentSelectionYear()) ||
            !this.months.includes(this.selectedMonth) ||
            !this.years.includes(this.selectedYear);
    }

    disablePreviousMonth(): boolean {
        return this.months.length === 0 ||
            (this.months[0] === this.selectedMonth && this.years[0] === this.getCurrentSelectionYear()) ||
            !this.months.includes(this.selectedMonth) ||
            !this.years.includes(this.selectedYear);
    }

    disableNextYear(): boolean {
        return this.years.length === 0 ||
            this.years[this.years.length - 1] === this.selectedYear ||
            !this.months.includes(this.selectedMonth) ||
            !this.years.includes(this.selectedYear);
    }

    disablePreviousYear(): boolean {
        return this.years.length === 0 ||
            this.years[0] === this.selectedYear ||
            !this.months.includes(this.selectedMonth) ||
            !this.years.includes(this.selectedYear);
    }

    private setTime(refDate: Moment, time: string): void {
        if (time) {
            const locale = moment.locale();
            moment.locale('en');
            const timeMoment = moment(time, this.TIME_FORMAT);
            moment.locale(locale);
            refDate.set('hour', timeMoment.hour());
            refDate.set('minute', timeMoment.minute());
        }
    }

    // ============================================================================
    // TrackBy Functions for Performance
    // ============================================================================

    /**
     * TrackBy function for generic index-based tracking
     */
    trackByIndex = (index: number): number => index;

    /**
     * TrackBy function for day objects in calendar grid
     * Uses date number and index for unique identification
     */
    trackByDay = (index: number, day: Day | null): string => {
        return day ? `day-${day.date}-${index}` : `empty-${index}`;
    };

    /**
     * TrackBy function for month names
     */
    trackByMonth = (index: number, month: string): string => month;

    /**
     * TrackBy function for year numbers
     */
    trackByYear = (index: number, year: number): number => year;
}
