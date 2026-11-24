import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { SubmitType } from '../../../models/message.model';

/**
 * MessageSidebarsComponent
 *
 * Displays sidebar buttons for form messages that allow users to trigger
 * side conversations or alternative actions without submitting the main form.
 *
 * (originally ported from the React chatbot)
 */
@Component({
  selector: 'app-message-sidebars',
  standalone: false,
  templateUrl: './message-sidebars.component.html',
  styleUrl: './message-sidebars.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageSidebarsComponent {
  /**
   * Array of sidebar labels to display as buttons
   */
  @Input() sidebars: string[] = [];

  /**
   * Whether the sidebars are read-only (disabled)
   * Typically true when form has been submitted or is a no-answer form
   */
  @Input() readOnly: boolean = false;

  /**
   * The label of the sidebar button that is currently disabled
   * while awaiting a WebSocket response. Null means no individual
   * button is pending.
   */
  @Input() disabledSidebar: string | null = null;

  /**
   * Emits when a sidebar button is clicked
   * Payload includes the submit type (sidebar) and the sidebar label
   */
  @Output() sidebarClick = new EventEmitter<{ type: SubmitType; sidebar: string }>();

  /**
   * Returns true when this sidebar button should be disabled.
   * Disables ALL sidebars when any sidebar is clicked (disabledSidebar is set),
   * preventing the user from clicking multiple sidebars before a response arrives.
   */
  isDisabled(sidebar: string): boolean {
    return this.readOnly || this.disabledSidebar !== null;
  }

  /**
   * Handle sidebar button click
   * @param sidebar The sidebar label that was clicked
   */
  onSidebarClick(sidebar: string): void {
    if (!this.isDisabled(sidebar)) {
      this.sidebarClick.emit({ type: SubmitType.sidebar, sidebar });
    }
  }

  /**
   * TrackBy function for sidebars to prevent unnecessary DOM recreation
   */
  trackBySidebar(index: number, sidebar: string): string {
    return sidebar;
  }
}

