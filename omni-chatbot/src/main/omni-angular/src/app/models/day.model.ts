/**
 * Model class representing a calendar day in the date picker.
 * Used by DateRangePickerComponent to render calendar grid.
 */
export class Day {
    constructor(
        readonly date: number,
        private _selectedRange: boolean,
        private _startDate: boolean,
        private _endDate: boolean,
        private _selectDate: boolean,
        private _disabled: boolean,
        private _isToday: boolean,
    ) {}

    /**
     * Whether this day is within the selected date range
     */
    get selectedRange(): boolean {
        return this._selectedRange;
    }

    set selectedRange(value: boolean) {
        this._selectedRange = value;
    }

    /**
     * Whether this day is the start date of the range
     */
    get startDate(): boolean {
        return this._startDate;
    }

    set startDate(value: boolean) {
        this._startDate = value;
    }

    /**
     * Whether this day is the end date of the range
     */
    get endDate(): boolean {
        return this._endDate;
    }

    set endDate(value: boolean) {
        this._endDate = value;
    }

    /**
     * Whether this day is the selected date (for single date selection)
     */
    get selectDate(): boolean {
        return this._selectDate;
    }

    set selectDate(value: boolean) {
        this._selectDate = value;
    }

    /**
     * Whether this day is disabled (outside min/max range)
     */
    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(value: boolean) {
        this._disabled = value;
    }

    /**
     * Whether this day is today
     */
    get isToday(): boolean {
        return this._isToday;
    }

    set isToday(value: boolean) {
        this._isToday = value;
    }
}

