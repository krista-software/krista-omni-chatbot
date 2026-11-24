import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

export enum SkeletonVariant {
  applogo = 'applogo',
  text = 'text',
  rectangular = 'rectangular',
  circular = 'circular',
  spinner = 'spinner'
}

@Component({
  selector: 'app-loading-skeleton',
  standalone: false,
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSkeletonComponent {
  @Input() variant: SkeletonVariant = SkeletonVariant.text;
  @Input() logoSrc?: string;
  @Input() width?: string;
  @Input() height?: string;
  @Input() animation: 'pulse' | 'wave' | false = 'pulse';

  SkeletonVariant = SkeletonVariant;

  get skeletonClasses(): string[] {
    const classes = ['skeleton-base'];
    
    switch (this.variant) {
      case SkeletonVariant.text:
        classes.push('skeleton-text');
        break;
      case SkeletonVariant.rectangular:
        classes.push('skeleton-rectangular');
        break;
      case SkeletonVariant.circular:
        classes.push('skeleton-circular');
        break;
      case SkeletonVariant.applogo:
        classes.push('skeleton-applogo');
        break;
      case SkeletonVariant.spinner:
        classes.push('skeleton-spinner');
        break;
    }

    if (this.animation) {
      classes.push(`skeleton-${this.animation}`);
    }

    return classes;
  }

  get skeletonStyles(): { [key: string]: string } {
    const styles: { [key: string]: string } = {};
    
    if (this.width) {
      styles['width'] = this.width;
    }
    
    if (this.height) {
      styles['height'] = this.height;
    }

    return styles;
  }
}
