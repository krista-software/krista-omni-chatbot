import React, { useEffect, useMemo, useState } from "react";
import { CircularProgress, IconButton, InputAdornment } from "@mui/material";
import { LocationOn } from "@mui/icons-material";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../../types";
import { FieldTypes } from "../../../state-managers";
import { Location } from "../../../state-managers";
import { Priorities } from "../../../Priorities";
import { LocationPicker } from "./location-picker/LocationPicker";
import { PermissionAlertDialog } from "./location-picker/PermissionAlertDialog";
import { KristaTypeField } from "../../../state-managers";
import { KristaFieldAttributes } from "../../../state-managers";
import { KristaValue } from "../../../state-managers";
import { TextFieldStyled } from "../components/TextFieldStyled";
import { fetchCurrentLocation, getGeoCode } from "./locationUtils";
import { ReadOnlyFieldContent } from "../components/ReadOnlyFieldContent";
import { FieldErrorMessage } from "../components/FieldErrorMessage";
import { MessageType } from "../../../../messaging";

export const LocationFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const { allowMapSelection, tooltip } = useMemo(() => {
    const _allowMapSelection: boolean =
      kristaTypeField.attributes.get("allowMapSelection") || false;
    return {
      allowMapSelection: _allowMapSelection,
      tooltip: kristaTypeField.attributes.toolTip,
    };
  }, []);
  const { t } = useTranslation();
  const [value, setValue] = useState(() => kristaTypeField.getKristaValue().getValue());
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const [fetching, setFetching] = useState(false);
  const [openLocationPicker, setOpenLocationPicker] = useState(false);
  const [locationError, setLocationPermissionError] = useState("");
  const [locationInfo, setLocationInfo] = useState(() => {
    return Location.fromJSON(kristaTypeField.getKristaValue().getValue());
  });

  useEffect(() => {
    setLocationInfo(Location.fromJSON(value));
  }, [value]);

  const updateLocation = (locInfo?: Location) => {
    kristaTypeField.setValue(locInfo?.toJSON());
    setValue(locInfo);
  };

  function handleSet(locInfo?: Location) {
    setOpenLocationPicker(false);
    if (!locInfo) {
      return;
    }
    setFetching(true);
    getGeoCode(locInfo.latitude, locInfo.longitude, (_locationInfo) => {
      updateLocation(_locationInfo);
      setFetching(false);
    });
  }

  function handleRemove() {
    setOpenLocationPicker(false);
    updateLocation(undefined);
  }

  const handleLocationSelection = () => {
    if (kristaTypeField.readOnly || options.readOnly) return;
    if (!allowMapSelection) {
      setFetching(true);
      fetchCurrentLocation(
        (location) => {
          handleSet(Location.fromLocation(location));
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
    } else {
      setOpenLocationPicker(true);
    }
  };

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  function openModal() {
    setOpenLocationPicker(true);
  }

  let correctedLocation = locationInfo?.getLocation();
  if (correctedLocation) {
    correctedLocation = {
      lat: +correctedLocation.lat,
      lng: +correctedLocation.lng,
    };
  }

  if (kristaTypeField.readOnly || options.readOnly) {
    return (
      <Box>
        <ReadOnlyFieldContent
          label={kristaTypeField.displayLabel}
          required={
            kristaTypeField.required && options.messageType !== MessageType.Inform
          }
          hideLabel={kristaTypeField.isInsideTable}
          content={
            <Box onClick={openModal} sx={{ cursor: "pointer" }}>
              {locationInfo?.toString() || ""}
            </Box>
          }
          title={tooltip}
        />
        {openLocationPicker && (
          <LocationPicker
            openDialog={openLocationPicker}
            handleSet={handleSet}
            handleRemove={handleRemove}
            locationPickerProps={{
              location: correctedLocation,
              readOnly: kristaTypeField.readOnly || !!options.readOnly,
            }}
          />
        )}
      </Box>
    );
  }

  return (
    <React.Fragment>
      {openLocationPicker && (
        <LocationPicker
          openDialog={openLocationPicker}
          handleSet={handleSet}
          handleRemove={handleRemove}
          locationPickerProps={{
            location: correctedLocation,
            readOnly: kristaTypeField.readOnly || !!options.readOnly,
          }}
        />
      )}

      {Boolean(locationError) && (
        <PermissionAlertDialog
          message={locationError}
          open={Boolean(locationError)}
          onClose={() => {
            setFetching(false);
            setLocationPermissionError("");
          }}
        ></PermissionAlertDialog>
      )}
      {kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
      <TextFieldStyled
        variant="standard"
        required={kristaTypeField.required}
        fullWidth
        label={
          kristaTypeField.isInsideTable ? (
            ""
          ) : (
            <span title={tooltip}>{kristaTypeField.displayLabel}</span>
          )
        }
        placeholder={
          kristaTypeField.readOnly || options.readOnly
            ? ""
            : t("placeholder.set", { fieldName: kristaTypeField.label })
        }
        hiddenLabel={kristaTypeField.isInsideTable}
        value={locationInfo?.toString() || ""}
        error={!(kristaTypeField.readOnly || options.readOnly) && Boolean(error)}
        helperText={
          !kristaTypeField.isInsideTable &&
          !(kristaTypeField.readOnly || options.readOnly) &&
          Boolean(error)
            ? error
            : ""
        }
        InputLabelProps={{
          shrink: true,
        }}
        InputProps={{
          readOnly: kristaTypeField.readOnly || options.readOnly,
          disableUnderline:
            kristaTypeField.readOnly || options.readOnly || kristaTypeField.isInsideTable,
          endAdornment: !(kristaTypeField.readOnly || options.readOnly) ? (
            <InputAdornment position="end">
              {fetching ? (
                <IconButton size="small">
                  <CircularProgress size={16}></CircularProgress>
                </IconButton>
              ) : (
                <IconButton onClick={handleLocationSelection} size="small">
                  <LocationOn fontSize="inherit" />
                </IconButton>
              )}
            </InputAdornment>
          ) : null,
        }}
      />
    </React.Fragment>
  );
}) as ReactFieldRenderer;

LocationFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.LOCATION_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
