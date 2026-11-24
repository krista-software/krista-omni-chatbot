import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'krista-button',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span 
      class="krista-button-wrapper"
      [attr.data-name]="name"
      [attr.data-button-type]="buttonType"
      (click)="handleClick()"
    >
      {{ name }}
    </span>
  `,
  styles: [`
    .krista-button-wrapper {
      background: var(--krista-text-primary, #3f3920);
      color: var(--krista-background-paper, #ffffff);
      align-items: center;
      padding: 2px 10px;
      border-radius: 30px;
      cursor: pointer;
      font-size: 0.800rem;
      font-weight: 400;
      word-break: break-word;
      display: inline-block;
      margin: 2px;
      transition: background-color 0.2s ease;
    }

    .krista-button-wrapper:hover {
      background: var(--krista-text-primary, #4a4228);
      opacity: 0.9;
    }

    .krista-button-wrapper:active {
      background: var(--krista-text-primary, #2f2a18);
      opacity: 0.8;
    }
  `]
})
export class KristaButtonComponent implements OnInit {
  @Input() name: string = '';
  @Input() buttonType: string = '';
  @Input() wsid: string = '';
  @Input() topicid: string = '';
  @Input() cid: string = '';
  @Input() view: string = '';
  
  @Output() buttonClick = new EventEmitter<{name: string, buttonType: string}>();

  ngOnInit() {
    // Set data-href attribute if workspace parameters are provided
    if (this.wsid && this.topicid && this.cid && this.view) {
      const dataHref = `/workspace/${this.wsid}/${this.topicid}/initiate-conversation?cId=${this.cid}&view=${this.view}`;
      // This would be set on the host element if needed
    }
  }

  handleClick() {
    this.buttonClick.emit({ name: this.name, buttonType: this.buttonType });
  }
}
