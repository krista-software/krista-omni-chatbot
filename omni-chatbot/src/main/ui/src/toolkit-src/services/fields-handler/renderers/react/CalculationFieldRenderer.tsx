import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers/FieldTypes";
import { NumericRenderer } from "./components/NumericRenderer";
import { KristaValue } from "../../state-managers/field-values/KristaValue";
import { KristaTypeField } from "../../state-managers/fields/KristaTypeField";
import { KristaFieldAttributes } from "../../state-managers/field-attributes/KristaFieldAttributes";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { MessageType } from "../../../messaging/message/KSDKMessage";

export const CalculationFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState<string>(() => kristaTypeField.formattedValue || "");
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });

  const { t } = useTranslation();

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setValue(newValue.toString());
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  if (kristaTypeField.readOnly || options.readOnly) {
    return (
      <ReadOnlyFieldContent
        label={kristaTypeField.displayLabel}
        required={kristaTypeField.required && options.messageType !== MessageType.Inform}
        hideLabel={kristaTypeField.isInsideTable}
        content={value}
      />
    );
  }

  return (
    <NumericRenderer
      value={value}
      formattedValue={value}
      label={kristaTypeField.displayLabel}
      placeholder={
        !(kristaTypeField.readOnly || options.readOnly)
          ? t("placeholder.enter", { fieldName: kristaTypeField.label })
          : ""
      }
      required={kristaTypeField.required}
      error={error}
      readOnly={kristaTypeField.readOnly || options.readOnly}
      isInsideTable={kristaTypeField.isInsideTable}
    ></NumericRenderer>
  );
}) as ReactFieldRenderer;

CalculationFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.CALCULATION_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
