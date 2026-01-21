import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { NumericRenderer } from "./components/NumericRenderer";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { getMaskedValue } from "../../utils/fields";
import { MessageType } from "../../../messaging";
import { isDefined } from "../../../../common/utils";

export const NumberFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState<string>(() => {
    const _val = kristaTypeField.getKristaValue().getValue();
    if (kristaTypeField.fieldType === FieldTypes.PERCENTAGE_FIELD) {
      return isDefined(_val) ? _val * 100 : "";
    }
    return isDefined(_val) ? _val : "";
  });
  const [formattedValue, setFormattedValue] = useState<string>(
    () => kristaTypeField.formattedValue || ""
  );
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const { secured, tooltip } = useMemo(() => {
    const _secured: boolean = kristaTypeField.attributes.get("isSecured") || false;
    return {
      secured: _secured,
      tooltip: kristaTypeField.attributes.toolTip,
    };
  }, []);

  const { t } = useTranslation();

  function setValueInState(valueToSet: string) {
    if (kristaTypeField.fieldType === FieldTypes.PERCENTAGE_FIELD) {
      kristaTypeField.setValue(valueToSet ? Number(valueToSet) / 100 : undefined);
    } else {
      kristaTypeField.setValue(valueToSet || undefined);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    let val = e.target.value;
    setValue(val);
    updateState(e);
  }

  // TODO check all onBlur events. is this required?
  function updateState(e: React.ChangeEvent<HTMLInputElement>): void {
    const _val = e.target.value;
    setValueInState(_val);
  }

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>): void {
    const val = (e.target as HTMLInputElement).value;
    setValue(val);
    setValueInState(val);
    if (options.onEnter) {
      options.onEnter();
    }
  }

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setFormattedValue(kristaTypeField.formattedValue);
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  const maskedValue = useMemo(() => {
    return getMaskedValue(formattedValue || "");
  }, [formattedValue]);

  if (kristaTypeField.readOnly || options.readOnly) {
    return (
      <ReadOnlyFieldContent
        label={kristaTypeField.displayLabel}
        required={kristaTypeField.required && options.messageType !== MessageType.Inform}
        hideLabel={kristaTypeField.isInsideTable}
        content={secured ? maskedValue : formattedValue}
        title={tooltip}
      />
    );
  }

  return (
    <NumericRenderer
      value={value}
      formattedValue={formattedValue}
      label={kristaTypeField.displayLabel}
      placeholder={
        !(kristaTypeField.readOnly || options.readOnly)
          ? t("placeholder.enter", { fieldName: kristaTypeField.label })
          : ""
      }
      required={kristaTypeField.required}
      secured={secured}
      error={error}
      readOnly={kristaTypeField.readOnly || options.readOnly}
      isInsideTable={kristaTypeField.isInsideTable}
      onChange={handleChange}
      onEnter={handleEnter}
      title={tooltip}
      autoFocus={options.autoFocus}
    ></NumericRenderer>
  );
}) as ReactFieldRenderer;

NumberFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.NUMBER_FIELD:
    case FieldTypes.PERCENTAGE_FIELD:
    case FieldTypes.UNIT_FIELD:
    case FieldTypes.CURRENCY_FIELD:
    case FieldTypes.DOUBLE_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
