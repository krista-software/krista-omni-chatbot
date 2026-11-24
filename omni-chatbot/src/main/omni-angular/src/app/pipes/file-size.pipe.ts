import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe for formatting file sizes in human-readable format.
 * Converts bytes to appropriate unit (Bytes, KB, MB, GB).
 *
 * Usage: {{ fileSize | fileSize }}
 * Example: {{ 1048576 | fileSize }} => "1 MB"
 */
@Pipe({
  name: 'fileSize',
  standalone: false,
  pure: true
})
export class FileSizePipe implements PipeTransform {
  private readonly units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  private readonly base = 1024;

  transform(bytes: number | null | undefined, decimals: number = 2): string {
    if (bytes === null || bytes === undefined || bytes === 0) {
      return '0 Bytes';
    }

    if (bytes < 0) {
      return '0 Bytes';
    }

    const unitIndex = Math.floor(Math.log(bytes) / Math.log(this.base));
    const clampedIndex = Math.min(unitIndex, this.units.length - 1);
    const value = bytes / Math.pow(this.base, clampedIndex);

    return `${parseFloat(value.toFixed(decimals))} ${this.units[clampedIndex]}`;
  }
}

