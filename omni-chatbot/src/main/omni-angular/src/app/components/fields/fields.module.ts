import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import { TranslateModule } from '@ngx-translate/core';
import { NgxEditorModule } from 'ngx-editor';

// Shared Module (includes CommonModule, MaterialModule, Pipes)
import { SharedModule } from '../../shared/shared.module';

// Field Components
import { TextFieldComponent } from './text-field/text-field.component';
import { NumberFieldComponent } from './number-field/number-field.component';
import { RichTextFieldComponent } from './rich-text-field/rich-text-field.component';
import { DateFieldComponent } from './date-field/date-field.component';
import { DateRangeFieldComponent } from './date-range-field/date-range-field.component';
import { DateTimeRangeFieldComponent } from './date-time-range-field/date-time-range-field.component';
import { TimeFieldComponent } from './time-field/time-field.component';
import { LocationFieldComponent } from './location-field/location-field.component';
import { PickOneFieldComponent } from './pick-one-field/pick-one-field.component';
import { PickManyFieldComponent } from './pick-many-field/pick-many-field.component';
import { RatingFieldComponent } from './rating-field/rating-field.component';
import { SwitchFieldComponent } from './switch-field/switch-field.component';
import { FileFieldComponent } from './file-field/file-field.component';
import { AddressFieldComponent } from './address-field/address-field.component';
import { MultiFieldComponent } from './multi-field/multi-field.component';
import { LocationPickerDialogComponent } from './location-field/location-picker-dialog/location-picker-dialog.component';
import { DynamicFieldComponent } from './dynamic-field/dynamic-field.component';
import { EntitySelectorFieldComponent } from './entity-selector-field/entity-selector-field.component';
import { EntitySearchModalComponent } from './entity-selector-field/entity-search-modal/entity-search-modal.component';
import { ListFieldComponent } from './list-field/list-field.component';
import { TableFieldComponent } from './table-field/table-field.component';
import { ContentStreamFieldComponent } from './content-stream-field/content-stream-field.component';

// Shared Components that depend on field components
import { NewTableComponent } from '../shared/table/new-table/new-table.component';
import { DateRangePickerComponent } from '../shared/date-range-picker/date-range-picker.component';
import { TimeDisplayComponent } from '../shared/time-display/time-display.component';
import { ComplexFieldModalComponent } from '../shared/complex-field-modal/complex-field-modal.component';

/**
 * FieldsModule
 * Contains all field components used for form rendering in the chatbot.
 * This module encapsulates all 18+ field types for better organization.
 *
 * Also includes NewTableComponent since it depends on field components.
 */
@NgModule({
  declarations: [
    // Core Field Components
    TextFieldComponent,
    NumberFieldComponent,
    RichTextFieldComponent,
    DateFieldComponent,
    DateRangeFieldComponent,
    DateTimeRangeFieldComponent,
    TimeFieldComponent,
    LocationFieldComponent,
    PickOneFieldComponent,
    PickManyFieldComponent,
    RatingFieldComponent,
    SwitchFieldComponent,
    FileFieldComponent,
    AddressFieldComponent,
    MultiFieldComponent,
    ListFieldComponent,
    TableFieldComponent,

    // Dialog Components
    LocationPickerDialogComponent,

    // Dynamic Field Rendering
    DynamicFieldComponent,

    // Entity Selection
    EntitySelectorFieldComponent,
    EntitySearchModalComponent,

    // Table Component (depends on field components)
    NewTableComponent,

    // Date Range Picker Component
    DateRangePickerComponent,

    // Time Display Component
    TimeDisplayComponent,

    // Complex Field Modal (for MultiField/Composite in table cells)
    ComplexFieldModalComponent,
  ],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    GoogleMapsModule,
    TranslateModule,
    SharedModule,
    NgxMaterialTimepickerModule,
    NgxEditorModule,
    ContentStreamFieldComponent, // Standalone component
  ],
  exports: [
    // Export all field components for use in other modules
    TextFieldComponent,
    NumberFieldComponent,
    RichTextFieldComponent,
    DateFieldComponent,
    DateRangeFieldComponent,
    DateTimeRangeFieldComponent,
    TimeFieldComponent,
    LocationFieldComponent,
    PickOneFieldComponent,
    PickManyFieldComponent,
    RatingFieldComponent,
    SwitchFieldComponent,
    FileFieldComponent,
    AddressFieldComponent,
    MultiFieldComponent,
    ListFieldComponent,
    TableFieldComponent,
    LocationPickerDialogComponent,
    DynamicFieldComponent,
    EntitySelectorFieldComponent,
    EntitySearchModalComponent,
    NewTableComponent,
    DateRangePickerComponent,
    TimeDisplayComponent,
  ]
})
export class FieldsModule { }

