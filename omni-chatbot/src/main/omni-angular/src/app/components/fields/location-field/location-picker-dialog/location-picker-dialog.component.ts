import { Component, Inject, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GoogleMap, MapMarker } from '@angular/google-maps';

export interface LocationPickerData {
  location?: { lat: number; lng: number };
  readOnly: boolean;
  allowMapSelection: boolean;
}

export interface LocationInfo {
  lat: number;
  lng: number;
  address: string;
}

@Component({
  selector: 'app-location-picker-dialog',
  templateUrl: './location-picker-dialog.component.html',
  styleUrls: ['./location-picker-dialog.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationPickerDialogComponent implements OnInit {
  @ViewChild(GoogleMap) map!: GoogleMap;

  center: google.maps.LatLngLiteral;
  location?: google.maps.LatLngLiteral;
  locationAddress: string = '';
  zoom = 17;
  fetching = false;
  locationError = '';
  searchQuery = '';
  searchResults: any[] = [];
  showSuggestions = false;
  isSearching = false;
  geocoder?: google.maps.Geocoder;

  mapOptions: google.maps.MapOptions = {
    clickableIcons: true,
    fullscreenControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    zoomControl: true,
  };

  markerOptions: google.maps.MarkerOptions = {
    draggable: true,
  };

  constructor(
    public dialogRef: MatDialogRef<LocationPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LocationPickerData,
    private cdr: ChangeDetectorRef
  ) {
    this.center = data.location || { lat: 0, lng: 0 };
    this.location = data.location;

    // Disable marker dragging in readonly mode
    if (data.readOnly) {
      this.markerOptions = {
        draggable: false,
      };
    }
  }

  ngOnInit(): void {
    // Initialize geocoder
    this.geocoder = new google.maps.Geocoder();

    // If no location is provided and not readonly, fetch current location
    if (!this.data.location && !this.data.readOnly) {
      this.fetchCurrentLocation();
    }
  }

  fetchCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationError = 'Geolocation is not supported by this browser.';
      return;
    }

    this.fetching = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.fetching = false;
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.center = location;
        this.location = location;
        this.getAddressFromCoordinates(location);
        this.cdr.markForCheck();
      },
      (error) => {
        this.fetching = false;
        if (error.code === 1) {
          this.locationError = 'Please grant permission to access your location.';
        } else {
          this.locationError = 'Unable to retrieve your location.';
        }
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true }
    );
  }

  onMapClick(event: google.maps.MapMouseEvent): void {
    if (this.data.readOnly || !event.latLng) {
      return;
    }

    const location = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };

    this.location = location;
    this.getAddressFromCoordinates(location);
  }

  onMarkerDragEnd(event: google.maps.MapMouseEvent): void {
    if (this.data.readOnly || !event.latLng) {
      return;
    }

    const location = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };

    this.location = location;
    this.getAddressFromCoordinates(location);
  }

  getAddressFromCoordinates(location: google.maps.LatLngLiteral): void {
    if (!this.geocoder) {
      return;
    }

    this.geocoder.geocode(
      { location: location },
      (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          this.locationAddress = results[0].formatted_address;
        } else {
          this.locationAddress = `${location.lat}, ${location.lng}`;
        }
        this.cdr.markForCheck();
      }
    );
  }

  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery = query;

    if (query.length === 0) {
      this.handleClearSearch();
      return;
    }

    this.searchPlaces(query);
  }

  searchPlaces(query: string): void {
    if (!query || query.length === 0) {
      return;
    }

    this.isSearching = true;
    this.showSuggestions = true;

    // Use Google Places Autocomplete Service
    const service = new google.maps.places.AutocompleteService();

    service.getPlacePredictions(
      {
        input: query,
        types: [] // Allow all types
      },
      (predictions, status) => {
        this.isSearching = false;

        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          this.searchResults = predictions.map(prediction => ({
            place_id: prediction.place_id,
            name: prediction.structured_formatting.main_text,
            formatted_address: prediction.description
          }));
        } else {
          this.searchResults = [];
        }
        this.cdr.markForCheck();
      }
    );
  }

  selectPlace(place: any): void {
    if (this.data.readOnly) {
      return;
    }

    // Use Places Service to get place details
    const service = new google.maps.places.PlacesService(
      document.createElement('div')
    );

    service.getDetails(
      {
        placeId: place.place_id,
        fields: ['geometry', 'formatted_address', 'name']
      },
      (placeResult, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && placeResult?.geometry?.location) {
          const location = {
            lat: placeResult.geometry.location.lat(),
            lng: placeResult.geometry.location.lng()
          };

          this.location = location;
          this.center = location;
          this.locationAddress = placeResult.formatted_address || placeResult.name || '';
          this.searchQuery = '';
          this.searchResults = [];
          this.showSuggestions = false;
        }
        this.cdr.markForCheck();
      }
    );
  }

  handleClearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSuggestions = false;
  }

  handleSet(): void {
    if (this.location) {
      const locationInfo: LocationInfo = {
        lat: this.location.lat,
        lng: this.location.lng,
        address: this.locationAddress || `${this.location.lat}, ${this.location.lng}`
      };
      this.dialogRef.close(locationInfo);
    }
  }

  handleClose(): void {
    this.dialogRef.close();
  }

  closeErrorDialog(): void {
    this.locationError = '';
  }

  /**
   * TrackBy function for search results to prevent unnecessary DOM recreation
   */
  trackByPlace(index: number, place: any): string {
    return place.place_id || index.toString();
  }
}

