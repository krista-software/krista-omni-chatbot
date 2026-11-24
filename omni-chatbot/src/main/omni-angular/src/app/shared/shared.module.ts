import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

// Material Module
import { MaterialModule } from './material.module';

// Pipes
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { FileSizePipe } from '../pipes/file-size.pipe';
import { TimeFormatPipe, FullDateTimePipe, DateFormatPipe } from '../pipes/time-format.pipe';
import {
  BooleanDisplayPipe,
  RatingDisplayPipe,
  TruncatePipe,
  PercentageDisplayPipe,
  CurrencyDisplayPipe
} from '../pipes/display-format.pipe';
import { ListRowFormatPipe } from '../pipes/list-row-format.pipe';

// Shared Components
import { LoadingComponent } from '../components/shared/loading/loading.component';
import { ImageModalComponent } from '../components/shared/image-modal/image-modal.component';
import { WaitingScreenComponent } from '../components/shared/waiting-screen/waiting-screen.component';
import { IdleWarningModalComponent } from '../components/shared/idle-warning-modal/idle-warning-modal.component';
import { InactivityDisconnectedComponent } from '../components/shared/inactivity-disconnected/inactivity-disconnected.component';
import { BootFailedComponent } from '../components/shared/boot-failed/boot-failed.component';

/**
 * SharedModule
 * Contains pipes, directives, and common components used across the application.
 * Import this module in any feature module that needs these shared resources.
 *
 * Note: NewTableComponent is declared in FieldsModule since it depends on field components.
 */
@NgModule({
  declarations: [
    // Pipes
    SafeHtmlPipe,
    FileSizePipe,
    TimeFormatPipe,
    FullDateTimePipe,
    DateFormatPipe,
    BooleanDisplayPipe,
    RatingDisplayPipe,
    TruncatePipe,
    PercentageDisplayPipe,
    CurrencyDisplayPipe,
    ListRowFormatPipe,

    // Shared Components
    LoadingComponent,
    ImageModalComponent,
    WaitingScreenComponent,
    IdleWarningModalComponent,
    InactivityDisconnectedComponent,
    BootFailedComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    TranslateModule,
  ],
  exports: [
    // Re-export CommonModule for convenience
    CommonModule,
    MaterialModule,
    TranslateModule,

    // Pipes
    SafeHtmlPipe,
    FileSizePipe,
    TimeFormatPipe,
    FullDateTimePipe,
    DateFormatPipe,
    BooleanDisplayPipe,
    RatingDisplayPipe,
    TruncatePipe,
    PercentageDisplayPipe,
    CurrencyDisplayPipe,
    ListRowFormatPipe,

    // Shared Components
    LoadingComponent,
    ImageModalComponent,
    WaitingScreenComponent,
    IdleWarningModalComponent,
    InactivityDisconnectedComponent,
    BootFailedComponent,
  ]
})
export class SharedModule { }

