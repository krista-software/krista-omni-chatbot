import { ToolkitConfig } from "../../../../../ToolkitConfig";
import { Location } from "../../../state-managers/classes/Location";

export function getGeoCode(
  lat: number,
  lng: number,
  result: (locationInfo?: Location) => void
) {
  let latLng = { lat: lat, lng: lng };
  const config = ToolkitConfig.getInstance().getConfig();
  if (!config || !google) {
    result(Location.fromLocation(latLng));
    return;
  }

  const geocoder = new google.maps.Geocoder();
  geocoder
    .geocode({ location: latLng }, (results, status) => {
      if (status === "OK" && results) {
        if (results[0]) {
          let city = "";
          let country = "";
          let zip = "";
          let area = "";
          let state = "";
          results[0].address_components.forEach((aComp: any) => {
            if (aComp.types.includes("locality")) {
              city = aComp.long_name;
            } else if (aComp.types.includes("country")) {
              country = aComp.long_name;
            } else if (aComp.types.includes("postal_code")) {
              zip = aComp.long_name;
            }
            if (
              !area &&
              (aComp.types.includes("sublocality") ||
                aComp.types.includes("sublocality_level_1") ||
                aComp.types.includes("neighborhood"))
            ) {
              area = aComp.long_name;
            }
            if (aComp.types.includes("administrative_area_level_1")) {
              state = aComp.long_name;
            }
          });

          const geoCodedLocation = new Location(lat, lng, Date.now());
          geoCodedLocation.city = city;
          geoCodedLocation.address = results[0]["formatted_address"];
          geoCodedLocation.country = country;
          geoCodedLocation.zip = zip;
          geoCodedLocation.area = area;
          geoCodedLocation.state = state;
          result(geoCodedLocation);
          return;
        }
      }
      result(Location.fromLocation(latLng));
    })
    .catch(() => {
      result(Location.fromLocation(latLng));
    });
}

export function fetchCurrentLocation(
  success: (location?: { lat: number; lng: number }) => void,
  error?: (error: GeolocationPositionError) => void
) {
  navigator.geolocation.getCurrentPosition(
    (location) => {
      success({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    },
    (ex) => {
      if (error) {
        error(ex);
      }
    },
    { enableHighAccuracy: true }
  );
}
