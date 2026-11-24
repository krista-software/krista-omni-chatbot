import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { KSDKMessage } from '../../../../ui-toolkit-src-angular';

@Component({
  selector: 'app-banner-wrapper',
  standalone: false,
  templateUrl: './banner-wrapper.component.html',
  styleUrl: './banner-wrapper.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BannerWrapperComponent {
  @Input() index: number = 0;
  @Input() messages: Array<KSDKMessage> = [];
  @Input() message!: KSDKMessage;
  @Input() unreadMessageId: string = '';
  @Input() firstItemIndex: number = 0;

  get showDate(): boolean {
    const lastMessage = this.messages[this.index - this.firstItemIndex - 1];
    const isSentOnDifferentDay = lastMessage &&
      !this.isSameDay(this.getMessageTime(this.message), this.getMessageTime(lastMessage));

    return this.index === this.firstItemIndex || isSentOnDifferentDay;
  }

  get showUnread(): boolean {
    return this.getMessageId(this.message) === this.unreadMessageId;
  }

  get dateText(): string {
    const messageTime = this.getMessageTime(this.message);
    if (messageTime) {
      const date = new Date(messageTime);
      return this.formatDate(date);
    }
    return '';
  }

  private getMessageTime(message: KSDKMessage): number {
    if (message.getCreationTime) {
      return message.getCreationTime();
    }
    return Date.now(); // fallback
  }

  private getMessageId(message: KSDKMessage): string {
    if (message.getId) {
      return message.getId();
    }
    return message.id; // fallback
  }

  private isSameDay(date1: number, date2: number): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  private formatDate(date: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName}, ${day} ${month} ${year}`;
  }
}
