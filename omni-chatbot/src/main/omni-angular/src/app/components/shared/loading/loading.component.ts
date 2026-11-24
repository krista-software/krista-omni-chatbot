import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

export enum LoadingVariant {
  spinner = 'spinner',
  dots = 'dots',
  applogo = 'applogo',
  text = 'text'
}

@Component({
  selector: 'app-loading',
  standalone: false,
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingComponent {
  @Input() variant: LoadingVariant = LoadingVariant.spinner;
  @Input() message: string = 'Loading...';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() logoSrc?: string;

  LoadingVariant = LoadingVariant;

  get spinnerDiameter(): number {
    switch (this.size) {
      case 'small': return 24;
      case 'medium': return 40;
      case 'large': return 64;
      default: return 40;
    }
  }
}
