import { Component, Input } from '@angular/core';

/**
 * Component to display time in a simple text format with AM/PM.
 * Matches the styling of date field for consistency.
 */
@Component({
    selector: 'app-time-display',
    templateUrl: './time-display.component.html',
    styleUrls: ['./time-display.component.scss'],
    standalone: false
})
export class TimeDisplayComponent {
    @Input() timeString: string = '';

    get hours(): string {
        if (!this.timeString) return '12';
        const parts = this.timeString.split(':');
        return parts[0] || '12';
    }

    get minutes(): string {
        if (!this.timeString) return '00';
        const parts = this.timeString.split(':');
        if (parts.length > 1) {
            return parts[1].split(' ')[0] || '00';
        }
        return '00';
    }

    get period(): string {
        if (!this.timeString) return 'AM';
        if (this.timeString.toLowerCase().includes('pm')) return 'PM';
        return 'AM';
    }
}

