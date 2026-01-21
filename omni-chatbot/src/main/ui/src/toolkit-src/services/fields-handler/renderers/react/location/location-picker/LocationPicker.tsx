import React, {useRef, useState} from "react";
import {GoogleMap, Marker} from "@react-google-maps/api";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import {useTranslation} from "react-i18next";
import {PermissionAlertDialog} from "./PermissionAlertDialog";
import {fetchCurrentLocation} from "../locationUtils";
import {ButtonStyled} from "../../components/ButtonStyled";
import {Location} from "../../../../state-managers";

export interface LocationPickerProps {
  location?: { lat: number; lng: number };
  readOnly: boolean;
}

export function LocationPicker({openDialog, locationPickerProps, handleSet, handleRemove}: {
  openDialog: boolean;
  locationPickerProps: LocationPickerProps;
  handleSet: (locationInfo?: Location) => void;
  handleRemove: () => void;
}) {
  const {t} = useTranslation();
  const [fetching, setFetching] = useState(false);
  const [center, setCenter] = useState(() => locationPickerProps.location);
  const [location, setLocation] = useState(() => locationPickerProps.location);
  const [locationError, setLocationPermissionError] = useState("");

  // Native autocomplete search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  const initializePlacesServices = () => {
    if (window?.google?.maps?.places) {
      placesService.current = new window.google.maps.places.PlacesService(document.createElement('div'));
    }
  };

  const onLoad = () => {
    initializePlacesServices();

    if (!locationPickerProps.location && !locationPickerProps.readOnly) {
      setFetching(true);
      fetchCurrentLocation(
        (location) => {
          setFetching(false);
          setCenter(location);
          setLocation(location);
        },
        (error) => {
          setFetching(false);
          if (error.code === 1) {
            setLocationPermissionError(t("krista.location.grantPermission"));
          } else {
            setLocationPermissionError(t("krista.general.defaultErrorMessage"));
          }
        }
      );
    }
  };

  const mapOptions = {
    center: {lat: center?.lat || 0, lng: center?.lng || 0},
    zoom: 17,
    clickableIcons: true,
    fullscreenControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    zoomControl: true,
  };

  const resetState = () => {
    setLocation(undefined);
    setSearchQuery("");
    setSearchResults([]);
    setShowSuggestions(false);
  };

  // Search for places using the new Google Places AutocompleteSuggestion API
  const searchPlaces = async (query: string) => {
    if (query.length == 0) {
      handleClearSearch();
      return;
    }

    setIsSearching(true);

    try {
      // Check if the new AutocompleteSuggestion API is available
      if (window?.google?.maps?.places && (window.google.maps.places as any).AutocompleteSuggestion) {

        // Use the new AutocompleteSuggestion API
        const request = {
          input: query,
          includedPrimaryTypes: [], // Allow all types
          language: 'en',
          region: 'US', // You can make this configurable
        };

        try {
          const {suggestions} = await (window.google.maps.places as any).AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

          setIsSearching(false);

          if (suggestions?.length > 0) {
            // Convert suggestions to place results
            const placeResults: google.maps.places.PlaceResult[] = suggestions.slice(0, 5).map((suggestion: any) => ({
              name: suggestion.placePrediction?.text?.text || suggestion.queryPrediction?.text?.text || 'Unknown',
              formatted_address: suggestion.placePrediction?.text?.text || suggestion.queryPrediction?.text?.text || '',
              place_id: suggestion.placePrediction?.placeId || null,
            }));

            setSearchResults(placeResults);
            setShowSuggestions(true);
            setSelectedSuggestionIndex(-1);
          } else {
            console.warn("❌ No suggestions from new API");
            setSearchResults([]);
            setShowSuggestions(false);
          }
        } catch (newApiError) {
          console.warn("❌ New AutocompleteSuggestion API failed:", newApiError);
          // Fallback to legacy API
          await searchWithLegacyAPI(query);
        }
      } else {
        // Fallback to legacy AutocompleteService API
        //New API not available, using legacy AutocompleteService;
        await searchWithLegacyAPI(query);
      }
    } catch (error) {
      console.error("❌ Error searching places:", error);
      setIsSearching(false);
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  // Fallback to legacy AutocompleteService API
  const searchWithLegacyAPI = async (query: string) => {
    try {
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        //  Places API not available
        return;
      }

      const autocompleteService = new window.google.maps.places.AutocompleteService();

      const request: google.maps.places.AutocompletionRequest = {
        input: query,
        types: [], // Allow all types
      };

      autocompleteService.getPlacePredictions(request, (predictions, status) => {
        setIsSearching(false);

        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          //🔍 Legacy API predictions
          // Convert predictions to place results
          const placeResults: google.maps.places.PlaceResult[] = predictions.slice(0, 5).map((prediction) => ({
            name: prediction.structured_formatting.main_text,
            formatted_address: prediction.description,
            place_id: prediction.place_id,
          }));

          setSearchResults(placeResults);
          setShowSuggestions(true);
          setSelectedSuggestionIndex(-1);
        } else {
          console.warn("❌ Legacy Places search failed:", status);
          setSearchResults([]);
          setShowSuggestions(false);
        }
      });
    } catch (error) {
      console.error("❌ Legacy API error:", error);
      setIsSearching(false);
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  // Handle search input change
  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    searchPlaces(query);
  };

  // Handle clear search input
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);

    // Focus back to the input after clearing
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Handle keyboard navigation in search input
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || searchResults.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < searchResults.length) {
          handleSuggestionClick(searchResults[selectedSuggestionIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;

      case 'Tab':
        // Allow tab to close suggestions and move focus
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;

      default:
        // Reset selection when typing
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (place: google.maps.places.PlaceResult) => {
    if (!placesService.current || !place.place_id) return;

    //  📍 Getting place details
    placesService.current.getDetails(
      {
        placeId: place.place_id,
        fields: ['name', 'geometry', 'formatted_address'],
      },
      (detailedPlace, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && detailedPlace?.geometry?.location) {
          const lat = detailedPlace.geometry.location.lat();
          const lng = detailedPlace.geometry.location.lng();

          // Update map center and marker position
          setCenter({lat, lng});
          setLocation({lat, lng});

          // Update search input with the selected place name
          setSearchQuery(detailedPlace.name || detailedPlace.formatted_address || "");

          // Hide suggestions
          setShowSuggestions(false);
        } else {
          console.error("❌ Failed to get place details:", status);
        }
      }
    );
  };

  return (
    <React.Fragment>
      <Dialog
        open={openDialog}
        maxWidth={"md"}
        sx={{
          "& .MuiDialog-paper": {
            height: "70%",
            width: "80%",
            margin: 0,
          },
        }}
      >
        <DialogTitle>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" component="div">
              {locationPickerProps.readOnly
                ? t("krista.location.selectedLocation")
                : t("krista.location.selectLocation")}
            </Typography>
            <IconButton
              aria-label="close"
              onClick={() => {
                resetState();
                handleSet();
              }}
            >
              <CloseIcon/>
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{p: 0, position: "relative"}}>
          {/* Native Google Places Search Box */}
          {!locationPickerProps.readOnly && (
            <Box sx={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              zIndex: 1000,
              maxWidth: 350
            }}>
              <TextField
                ref={searchInputRef}
                fullWidth
                variant="outlined"
                placeholder={t("fields.location.selectLocationPlaceholder")}
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                role="combobox"
                aria-expanded={showSuggestions}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                aria-activedescendant={
                  selectedSuggestionIndex >= 0
                    ? `suggestion-${selectedSuggestionIndex}`
                    : undefined
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action"/>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {isSearching ? (
                        <CircularProgress size={20}/>
                      ) : searchQuery ? (
                        <IconButton
                          size="small"
                          onClick={handleClearSearch}
                          edge="end"
                          aria-label="Clear search"
                          sx={{
                            padding: 0.5,
                            "&:hover": {
                              backgroundColor: "rgba(0, 0, 0, 0.04)",
                            }
                          }}
                        >
                          <ClearIcon fontSize="small"/>
                        </IconButton>
                      ) : null}
                    </InputAdornment>
                  ),
                  sx: {
                    backgroundColor: "white",
                    borderRadius: 1,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(0, 0, 0, 0.23)",
                    },
                  }
                }}
                size="small"
              />

              {/* Search Suggestions Dropdown */}
              {showSuggestions && searchResults.length > 0 && (
                <Box
                  role="listbox"
                  aria-label="Location suggestions"
                  sx={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid rgba(0, 0, 0, 0.23)",
                    borderRadius: 1,
                    mt: 0.5,
                    maxHeight: 300,
                    overflow: "auto",
                    zIndex: 1001,
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {searchResults.map((place, index) => (
                    <Box
                      key={place.place_id || index}
                      id={`suggestion-${index}`}
                      role="option"
                      aria-selected={index === selectedSuggestionIndex}
                      onClick={() => handleSuggestionClick(place)}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      sx={{
                        p: 1,
                        cursor: "pointer",
                        borderBottom: index < searchResults.length - 1 ? "1px solid rgba(0, 0, 0, 0.1)" : "none",
                        backgroundColor: index === selectedSuggestionIndex
                          ? "rgba(25, 118, 210, 0.08)"
                          : "transparent",
                        "&:hover": {
                          backgroundColor: index === selectedSuggestionIndex
                            ? "rgba(25, 118, 210, 0.12)"
                            : "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      <Typography variant="body2" fontWeight={500}>
                        {place.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {place.formatted_address}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Google Map */}
          {(
            <GoogleMap
              mapContainerStyle={{width: "100%", height: "100%"}}
              options={mapOptions}
              onClick={(event) => {
                if (locationPickerProps.readOnly) {
                  return;
                }
                const latLng = event.latLng;
                if (latLng) {
                  setLocation({lat: latLng.lat(), lng: latLng.lng()});
                }
              }}
              zoom={16}
              onLoad={onLoad}
            >
              {location && (
                <Marker
                  position={{
                    lat: location.lat,
                    lng: location.lng,
                  }}
                />
              )}
            </GoogleMap>
          )}
        </DialogContent>

        {!locationPickerProps.readOnly && !fetching && (
          <DialogActions>
            <Stack direction="row" width="100%">
              <ButtonStyled
                onClick={() => {
                  handleRemove();
                }}
              >
                {t("krista.general.remove")}
              </ButtonStyled>
              <div style={{flex: "1 0 0"}}/>
              <ButtonStyled
                onClick={() => {
                  resetState();
                  handleSet();
                }}
              >
                {t("krista.general.cancel")}
              </ButtonStyled>

              <ButtonStyled
                onClick={() => {
                  resetState();
                  handleSet(Location.fromLocation(location));
                }}
              >
                {t("krista.general.save")}
              </ButtonStyled>
            </Stack>
          </DialogActions>
        )}
      </Dialog>

      {Boolean(locationError) && (
        <PermissionAlertDialog
          message={locationError}
          open={Boolean(locationError)}
          onClose={() => {
            setLocationPermissionError("");
            handleSet();
          }}
        ></PermissionAlertDialog>
      )}
    </React.Fragment>
  );
}
