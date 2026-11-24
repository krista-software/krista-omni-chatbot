import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loader-container',
  standalone: false,
  templateUrl: './loader-container.component.html',
  styleUrl: './loader-container.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoaderContainerComponent {
  // Simple container component for loading states
}
