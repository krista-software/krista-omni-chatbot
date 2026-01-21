import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { TextRenderer, TextRendererProps } from "./components/TextRenderer";
import { ParagraphField } from "../../state-managers";
import { EmailField } from "../../state-managers";
import { IdentifierField } from "../../state-managers";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { getMaskedValue } from "../../utils/fields";
import { KristaFieldValueResolver } from "../../web-components";
import { MessageType } from "../../../messaging";

export const TextFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const [value, setValue] = useState<string>(() => {
    return (
      KristaFieldValueResolver.escapeNestedKristaField(kristaTypeField.getKristaValue().getValue()) || kristaTypeField.formattedValue
    );
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
  const { fieldProps, secured } = useMemo(() => {
    const _fieldProps: Partial<TextRendererProps> = {};
    if (kristaTypeField instanceof ParagraphField) {
      _fieldProps.allowNewLineOnEnterKey = true;
      _fieldProps.maxRows = kristaTypeField.attributes.maxLineCount;
    } else if (kristaTypeField instanceof EmailField) {
      _fieldProps.inputType = "email";
    } else if (kristaTypeField instanceof IdentifierField) {
      _fieldProps.pattern = kristaTypeField.attributes.get("pattern");
    }
    _fieldProps.title = kristaTypeField.attributes.toolTip;
    const _secured: boolean = kristaTypeField.attributes.get("isSecured") || false;
    return {
      fieldProps: _fieldProps,
      secured: _secured,
    };
  }, []);

  const { t } = useTranslation();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    let val = e.target.value;
    setValue(val);
    updateState(e);
  }

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (fieldProps?.allowNewLineOnEnterKey == true) {
      return;
    }
    const val = (e.target as HTMLInputElement).value;
    setValue(val);
    kristaTypeField.setValue(val);
    if (options.onEnter) {
      options.onEnter();
    }
  }

  function updateState(e: React.ChangeEvent<HTMLInputElement>): void {
    kristaTypeField.setValue(e.target.value || undefined);
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
    return getMaskedValue(formattedValue);
  }, [formattedValue]);

  if (kristaTypeField.readOnly || options.readOnly) {
    return (
      <ReadOnlyFieldContent
        label={kristaTypeField.displayLabel}
        required={kristaTypeField.required && options.messageType !== MessageType.Inform}
        hideLabel={kristaTypeField.isInsideTable}
        content={secured ? maskedValue : formattedValue}
        title={fieldProps.title}
      />
    );
  }

  return (
    <TextRenderer
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
      autoFocus={options.autoFocus}
      {...fieldProps}
    ></TextRenderer>
  );
}) as ReactFieldRenderer;

TextFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.PARAGRAPH_FIELD:
    case FieldTypes.EMAIL_FIELD:
    case FieldTypes.STREET_FIELD:
    case FieldTypes.STREET2_FIELD:
    case FieldTypes.CITY_FIELD:
    case FieldTypes.STATE_FIELD:
    case FieldTypes.POSTAL_CODE_FIELD:
    case FieldTypes.COUNTRY_FIELD:
    case FieldTypes.TEXT_FIELD:
    case FieldTypes.PERSON_FIELD:
    case FieldTypes.PROPER_NOUN_FIELD:
    case FieldTypes.IDENTIFIER_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
