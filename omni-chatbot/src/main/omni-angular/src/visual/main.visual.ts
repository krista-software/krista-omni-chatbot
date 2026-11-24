import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { VisualHarnessComponent } from './visual-harness.component';

/**
 * Entry point for the visual-regression harness. Built only via the `visual`
 * configuration in angular.json — never part of the shipped app.
 *
 * Animations are disabled (provideNoopAnimations) so screenshots are not taken
 * mid-transition.
 */
bootstrapApplication(VisualHarnessComponent, {
  providers: [
    provideNoopAnimations(),
    provideHttpClient(),
    importProvidersFrom(TranslateModule.forRoot())
  ]
}).catch(err => console.error(err));
