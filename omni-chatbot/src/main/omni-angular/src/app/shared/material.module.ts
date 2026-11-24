import { NgModule } from '@angular/core';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatRadioModule } from '@angular/material/radio';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

// CDK Modules
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { ScrollingModule } from '@angular/cdk/scrolling';

/**
 * Shared Material Module
 * Centralizes all Angular Material imports for better maintainability.
 * Import this module in AppModule or any feature module that needs Material components.
 */
const MATERIAL_MODULES = [
  // Buttons & Icons
  MatButtonModule,
  MatIconModule,

  // Form Controls
  MatInputModule,
  MatFormFieldModule,
  MatSelectModule,
  MatCheckboxModule,
  MatSlideToggleModule,
  MatRadioModule,

  // Layout
  MatCardModule,
  MatDividerModule,
  MatListModule,
  MatSidenavModule,
  MatToolbarModule,

  // Navigation & Menus
  MatMenuModule,
  MatTooltipModule,

  // Data Display
  MatTableModule,
  MatSortModule,
  MatPaginatorModule,
  MatChipsModule,
  MatAutocompleteModule,

  // Feedback
  MatProgressSpinnerModule,

  // Popups & Modals
  MatDialogModule,

  // Date/Time
  MatDatepickerModule,
  MatNativeDateModule,

  // CDK
  CdkTextareaAutosize,
  ScrollingModule,
];

@NgModule({
  imports: MATERIAL_MODULES,
  exports: MATERIAL_MODULES,
})
export class MaterialModule {}

