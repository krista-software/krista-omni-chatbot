import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { LocationPickerDialogComponent, LocationInfo } from './location-picker-dialog/location-picker-dialog.component';
import { LocationFieldConfig } from '../../../models/field-config.model';
import { GoogleMapsLoaderService } from '../../../services/google-maps-loader.service';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Location field component with built-in map picker dialog.
 * This component handles both geolocation and map selection internally,
 * making it library-ready with minimal parent dependencies.
 * Google Maps API is lazy loaded only when this component needs it.
 */
@Component({
  selector: 'app-location-field',
  templateUrl: './location-field.component.html',
  styleUrls: ['./location-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationFieldComponent {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: LocationFieldConfig = {
    displayValue: '',
    allowMapSelection: false,
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Event outputs
  @Output() valueChange = new EventEmitter<any>();

  // Internal state
  fetching: boolean = false;
  locationError: string = '';
  mapsLoading: boolean = false;

  constructor(
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private googleMapsLoader: GoogleMapsLoaderService,
    private translate: TranslateService
  ) {}

  /**
   * Handle location change from input
   */
  onLocationChange(value: string): void {
    this.valueChange.emit(value);
  }

  /**
   * Handle location selection button click
   */
  handleLocationSelection(): void {
    if (this.isFieldReadOnly()) {
      return;
    }

    if (!this.config?.allowMapSelection) {
      // Simple mode: just fetch current location
      this.getCurrentLocation();
    } else {
      // Map selection mode: open dialog
      this.openMapPicker();
    }
  }

  /**
   * Get current location using browser geolocation API.
   * Lazy loads Google Maps API before using geocoder.
   */
  private async getCurrentLocation(): Promise<void> {
    if (!navigator.geolocation) {
      this.locationError = 'Geolocation is not supported by this browser.';
      this.cdr.markForCheck();
      return;
    }

    this.fetching = true;
    this.locationError = '';
    this.cdr.markForCheck();

    // First, get the position
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          // Lazy load Google Maps API for geocoding
          this.mapsLoading = true;
          this.cdr.markForCheck();
          await this.googleMapsLoader.load();
          this.mapsLoading = false;

          // Use reverse geocoding to get address
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode(
            { location: { lat, lng } },
            (results: any, status: any) => {
              this.fetching = false;

              if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
                // Extract address components
                const addressComponents = results[0].address_components;
                let city = '';
                let state = '';
                let country = '';
                let zip = '';
                let area = '';

                addressComponents.forEach((component: any) => {
                  const types = component.types;
                  if (types.includes('locality')) {
                    city = component.long_name;
                  } else if (types.includes('administrative_area_level_1')) {
                    state = component.long_name;
                  } else if (types.includes('country')) {
                    country = component.long_name;
                  } else if (types.includes('postal_code')) {
                    zip = component.long_name;
                  } else if (types.includes('sublocality') || types.includes('neighborhood')) {
                    area = component.long_name;
                  }
                });

                // Create Location object
                const locationObject = {
                  type: 'com.krista.net.model.fieldschemas.Location',
                  latitude: lat,
                  longitude: lng,
                  dateTime: Date.now(),
                  address: results[0].formatted_address,
                  city: city,
                  country: country,
                  zip: zip,
                  area: area,
                  state: state
                };

                this.valueChange.emit(locationObject);
              } else {
                // Fallback to coordinates if geocoding fails
                const locationObject = {
                  type: 'com.krista.net.model.fieldschemas.Location',
                  latitude: lat,
                  longitude: lng,
                  dateTime: Date.now()
                };
                this.valueChange.emit(locationObject);
              }
              this.cdr.markForCheck();
            }
          );
        } catch (error) {
          this.fetching = false;
          this.mapsLoading = false;
          // Fallback to coordinates without address if Maps API fails to load
          const locationObject = {
            type: 'com.krista.net.model.fieldschemas.Location',
            latitude: lat,
            longitude: lng,
            dateTime: Date.now()
          };
          this.valueChange.emit(locationObject);
          this.cdr.markForCheck();
        }
      },
      (error) => {
        this.fetching = false;
        this.locationError = 'Unable to retrieve location. Please check your browser permissions.';
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true }
    );
  }

  /**
   * Open map picker dialog.
   * Lazy loads Google Maps API before opening the dialog.
   */
  private async openMapPicker(): Promise<void> {
    // Parse current location value
    let currentLocation: { lat: number; lng: number } | undefined;
    if (this.field.value && typeof this.field.value === 'object') {
      if (this.field.value.latitude !== undefined && this.field.value.longitude !== undefined) {
        currentLocation = {
          lat: this.field.value.latitude,
          lng: this.field.value.longitude
        };
      }
    }

    try {
      // Lazy load Google Maps API before opening dialog
      this.mapsLoading = true;
      this.cdr.markForCheck();
      await this.googleMapsLoader.load();
      this.mapsLoading = false;
      this.cdr.markForCheck();

      // Open the location picker dialog
      const dialogRef = this.dialog.open(LocationPickerDialogComponent, {
        width: '800px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        data: {
          location: currentLocation,
          readOnly: this.isFieldReadOnly(),
          allowMapSelection: this.config?.allowMapSelection
        }
      });

      dialogRef.afterClosed().subscribe((result: LocationInfo) => {
        if (result && result.lat !== undefined && result.lng !== undefined) {
          // Create Location object from map picker result
          const locationObject = {
            type: 'com.krista.net.model.fieldschemas.Location',
            latitude: result.lat,
            longitude: result.lng,
            dateTime: Date.now(),
            address: result.address || `${result.lat}, ${result.lng}`,
            city: '',
            country: '',
            zip: '',
            area: '',
            state: ''
          };

          this.valueChange.emit(locationObject);
        }
      });
    } catch (error) {
      this.mapsLoading = false;
      this.locationError = 'Failed to load Google Maps. Please try again.';
      this.cdr.markForCheck();
    }
  }

  /**
   * Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  /**
   * Check if field is read-only
   */
  isFieldReadOnly(): boolean {
    return this.config?.readOnly || this.field.readOnly || false;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config?.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Get field label with i18n support
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }

  /**
   * Get placeholder text
   * Uses translation service like original app does
   */
  getPlaceholder(): string {
    if (this.isFieldReadOnly()) {
      return '';
    }
    // Use displayName if available (for sub-fields), otherwise use name
    const fieldName = this.field.displayName || this.field.name;
    // Use translation service like: t("placeholder.set", { fieldName })
    return this.translate.instant('placeholder.set', { fieldName });
  }
}
