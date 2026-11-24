import { Injectable } from '@angular/core';

/**
 * Service to lazy load Google Maps API on demand.
 * This prevents the 168KB+ Google Maps script from blocking initial page render.
 * The script is only loaded when a component that needs maps is rendered.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleMapsLoaderService {
  private readonly API_KEY = 'REDACTED_SECRET';
  private readonly SCRIPT_ID = 'google-maps-script';

  private loadPromise: Promise<void> | null = null;
  private isLoaded = false;

  /**
   * Check if Google Maps API is already loaded
   */
  get loaded(): boolean {
    return this.isLoaded || this.isGoogleMapsAvailable();
  }

  /**
   * Load Google Maps API if not already loaded.
   * Returns a promise that resolves when the API is ready.
   * Multiple calls will return the same promise (singleton pattern).
   */
  load(): Promise<void> {
    // If already loaded, resolve immediately
    if (this.isGoogleMapsAvailable()) {
      this.isLoaded = true;
      return Promise.resolve();
    }

    // If loading is in progress, return existing promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.loadPromise = this.loadScript();
    return this.loadPromise;
  }

  /**
   * Check if Google Maps API is available in window
   */
  private isGoogleMapsAvailable(): boolean {
    return typeof google !== 'undefined' &&
           typeof google.maps !== 'undefined' &&
           typeof google.maps.Geocoder !== 'undefined';
  }

  /**
   * Dynamically inject the Google Maps script
   */
  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      if (document.getElementById(this.SCRIPT_ID)) {
        // Script tag exists, wait for it to load
        this.waitForGoogleMaps(resolve, reject);
        return;
      }

      // Create callback function name
      const callbackName = '__googleMapsCallback_' + Date.now();

      // Set up callback
      (window as any)[callbackName] = () => {
        this.isLoaded = true;
        delete (window as any)[callbackName];
        resolve();
      };

      // Create script element
      const script = document.createElement('script');
      script.id = this.SCRIPT_ID;
      script.type = 'text/javascript';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.API_KEY}&libraries=places&callback=${callbackName}`;
      script.async = true;
      script.defer = true;

      // Handle errors
      script.onerror = () => {
        delete (window as any)[callbackName];
        this.loadPromise = null;
        reject(new Error('Failed to load Google Maps API'));
      };

      // Append to document
      document.head.appendChild(script);
    });
  }

  /**
   * Wait for Google Maps to be available (for cases where script exists but not loaded)
   */
  private waitForGoogleMaps(resolve: () => void, reject: (error: Error) => void): void {
    const maxAttempts = 50; // 5 seconds max
    let attempts = 0;

    const checkInterval = setInterval(() => {
      attempts++;

      if (this.isGoogleMapsAvailable()) {
        clearInterval(checkInterval);
        this.isLoaded = true;
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        this.loadPromise = null;
        reject(new Error('Timeout waiting for Google Maps API'));
      }
    }, 100);
  }
}

