import React, { useEffect, useState } from "react";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";

import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { SelectionField } from "../../state-managers";
import { ReadOnlyFieldContent } from "./components/ReadOnlyFieldContent";
import { EntitySearchModal } from "./entity/EntitySearchModal";
import { TextFieldStyled } from "./components/TextFieldStyled";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { IEntitySearchResult } from "./entity";
import { EntityValueJson } from "../../state-managers";
import { MessageType } from "../../../messaging";

function prepareNewValueType(
  selections: IEntitySearchResult[]
): EntityValueJson[] {
  const typeEntityValues: EntityValueJson[] = [];
  selections.forEach((selection) => {
    typeEntityValues.push({
      fields: selection.value.fields,
      meta: selection.value.meta,
      textSummary: selection.textSummary,
    });
    // if (selection.value instanceof EntityValue) {
    //   const json = selection.value.toResponse();
    //   if (json) {
    //     json.textSummary = selection.textSummary;
    //     typeEntityValues.push(json);
    //   }
    // }
  });
  return typeEntityValues;
}

function prepareDisplayFromEntity(selection: EntityValueJson[] | undefined) {
  if (!selection) {
    return "";
  }
  return selection
    .map((json: EntityValueJson) => json.textSummary || "")
    .join(",\n");
}

export const SelectionFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const fieldState = kristaTypeField as SelectionField;
  const entitySelectorMeta = fieldState.attributes.entityMeta;
  const [value, setValue] = useState<any>(() =>
    fieldState.getKristaValue().getValue()
  );
  const [displayValue, setDisplayValue] = useState<string>(() => {
    const val = fieldState.getKristaValue().getValue();
    let str = "";
    if (!val) return str;
    if (Array.isArray(val))
      return val.map((entity) => entity.toString()).join(", ");
    if (val && val.toString) return val.toString();
    return str;
  });
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  const [open, setOpen] = useState<boolean>(false);
  const { t } = useTranslation();

  function handleOpen() {
    if (fieldState.readOnly || options.readOnly) return;
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function updateState(_value: EntityValueJson[] | undefined): void {
    if (entitySelectorMeta.isMultiSelect) {
      fieldState.setValue(_value);
    } else {
      fieldState.setValue(_value ? _value[0] : _value);
    }
    setValue(_value);
    setDisplayValue(prepareDisplayFromEntity(_value));
  }

  const clearSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    updateState(undefined);
  };

  const handleMouseDownOnClear = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
  };

  function handleSelection(selection?: IEntitySearchResult[]) {
    handleClose();
    if (!selection || selection.length === 0) {
      return;
    }
    updateState(prepareNewValueType(selection));
  }

  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
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
        content={displayValue}
      />
    );
  }

  return (
    <React.Fragment>
      {open ? (
        <EntitySearchModal
          entitySelectorMeta={entitySelectorMeta}
          onClose={handleClose}
          onSelect={(_selection) => handleSelection(_selection)}
          field={fieldState.field}
          getEntities={options.getEntities}
        />
      ) : null}
      {kristaTypeField.isInsideTable ? <FieldErrorMessage error={error} /> : null}
      <TextFieldStyled
        required={kristaTypeField.required}
        type="text"
        label={
          fieldState.isInsideTable ? (
            ""
          ) : (
            <span title={kristaTypeField.attributes.toolTip}>{fieldState.displayLabel}</span>
          )
        }
        value={displayValue}
        onClick={handleOpen}
        hiddenLabel={fieldState.isInsideTable}
        placeholder={
          !(fieldState.readOnly || options.readOnly)
            ? t("placeholder.select", {
                fieldName: fieldState.attributes.entityMeta?.entityName || "",
              })
            : ""
        }
        error={!(fieldState.readOnly || options.readOnly) && Boolean(error)}
        helperText={
          !fieldState.isInsideTable &&
          !(fieldState.readOnly || options.readOnly) &&
          Boolean(error)
            ? error
            : ""
        }
        variant="standard"
        InputLabelProps={{
          shrink: true,
        }}
        fullWidth
        InputProps={{
          readOnly: fieldState.readOnly || options.readOnly,
          disableUnderline:
            fieldState.readOnly || options.readOnly || fieldState.isInsideTable,
          endAdornment:
            value &&
            Array.isArray(value) &&
            value.length > 0 &&
            !(fieldState.readOnly || options.readOnly) ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear selection"
                  onClick={clearSelection}
                  onMouseDown={handleMouseDownOnClear}
                  size="small"
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              </InputAdornment>
            ) : null,
        }}
      />
    </React.Fragment>
  );
}) as ReactFieldRenderer;

SelectionFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.ENTITY_SELECTION:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
