import React, { useEffect, useMemo, useState } from "react";
import FormControl from "@mui/material/FormControl";
import Rating from "@mui/material/Rating";
import Icon from "@mui/material/Icon";

import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { ReactFieldRenderer } from "../types";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { MessageType } from "../../../messaging";

export const RatingFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState(
    () => kristaTypeField.getKristaValue().getValue() || null
  );
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const { ratingIcon, tooltip } = useMemo(() => {
    let _ratingIcon: string = kristaTypeField.attributes.get("ratingIcon") || "star";
    // TODO compatibility b/w angular material and react material icons
    // icons https://fonts.google.com/icons
    _ratingIcon = _ratingIcon.toLowerCase();
    return {
      ratingIcon: _ratingIcon,
      tooltip: kristaTypeField.attributes.toolTip,
    };
  }, []);

  function handleChange(newValue: number | null) {
    setValue(newValue);
    kristaTypeField.setValue(newValue ?? undefined);
  }

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  return (
    <FormControl component="fieldset">
      {!kristaTypeField.isInsideTable && (
        <FormLabel
          component="legend"
          sx={{ mb: 0.5 }}
          required={
            kristaTypeField.required && options.messageType !== MessageType.Inform
          }
          text={kristaTypeField.displayLabel}
          title={tooltip}
        />
      )}
      {kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
      <Rating
        name={kristaTypeField.displayLabel}
        readOnly={kristaTypeField.readOnly || options.readOnly}
        value={value}
        icon={
          <Icon fontSize="small" color="inherit">
            {ratingIcon}
          </Icon>
        }
        emptyIcon={
          <Icon fontSize="small" color="inherit">
            {ratingIcon}
          </Icon>
        }
        onChange={(event, newValue: any) => {
          handleChange(newValue);
        }}
        sx={{ "& .MuiIcon-root": { fontSize: 20 } }}
      />
      {!kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
    </FormControl>
  );
}) as ReactFieldRenderer;

RatingFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.RATING_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
