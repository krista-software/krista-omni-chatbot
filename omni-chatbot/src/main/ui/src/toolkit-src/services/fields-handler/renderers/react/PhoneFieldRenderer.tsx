import React, { useEffect, useMemo, useState } from "react";
import { parsePhoneNumber } from "libphonenumber-js";
import { useTranslation } from "react-i18next";

import { PhoneNumber } from "../../state-managers";
import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { TextRenderer } from "./components/TextRenderer";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { getMaskedValue } from "../../utils/fields";
import { MessageType } from "../../../messaging";

export const PhoneFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState<string>(() => kristaTypeField.formattedValue || "");
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

  const maskedValue = useMemo(() => {
    return getMaskedValue(formattedValue || "");
  }, [formattedValue]);

  const { t } = useTranslation();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setValue(e.target.value);
    updateState(e);
  }

  function updateState(e: React.ChangeEvent<HTMLInputElement>): void {
    convertToJson(e.target.value);
  }

  function convertToJson(stringValue: string) {
    stringValue = stringValue.trim();
    if (!stringValue) {
      kristaTypeField.setValue(undefined);
      return;
    }

    if (stringValue !== kristaTypeField.formattedValue) {
      let phoneNumber: PhoneNumber | undefined = undefined;
      try {
        const parsePhoneNum = parsePhoneNumber(stringValue);
        phoneNumber = new PhoneNumber(
          Number.parseInt(parsePhoneNum.countryCallingCode, 10),
          Number.parseInt(parsePhoneNum.nationalNumber, 10)
        );
        kristaTypeField.setValue(phoneNumber ? phoneNumber.toJSON() : stringValue);
        setValue(kristaTypeField.formattedValue);
      } catch (error) {
        const numberValue = Number.parseInt(stringValue.replace(/\D/g, ""));
        if (Number.isNaN(numberValue)) {
          kristaTypeField.setValue(undefined);
          setValue(kristaTypeField.formattedValue);
        } else {
          phoneNumber = new PhoneNumber(0, numberValue);
          kristaTypeField.setValue(phoneNumber ? phoneNumber.toJSON() : stringValue);
          setValue(kristaTypeField.formattedValue);
        }
      }
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
    <TextRenderer
      inputType="tel"
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
      title={tooltip}
    ></TextRenderer>
  );
}) as ReactFieldRenderer;

PhoneFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.PHONE_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
