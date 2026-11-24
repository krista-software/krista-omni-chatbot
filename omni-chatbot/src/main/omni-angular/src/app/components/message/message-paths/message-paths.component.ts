import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { SubmitType } from '../../../models/message.model';

@Component({
  selector: 'app-message-paths',
  standalone: false,
  templateUrl: './message-paths.component.html',
  styleUrl: './message-paths.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessagePathsComponent {
  @Input() paths: string[] = [];
  @Input() submittedPath?: string;
  @Output() pathClick = new EventEmitter<{ type: SubmitType; path: string }>();

  onPathClick(path: string): void {
    if (!this.submittedPath) {
      this.pathClick.emit({ type: SubmitType.path, path });
    }
  }

  isPathDisabled(path: string): boolean {
    return !!this.submittedPath;
  }

  getPathOpacity(path: string): number {
    if (!this.submittedPath || this.submittedPath === path) {
      return 1;
    }
    return 0.4;
  }

  /**
   * TrackBy function for paths to prevent unnecessary DOM recreation
   */
  trackByPath(index: number, path: string): string {
    return path;
  }
}
