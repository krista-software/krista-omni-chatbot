import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { ReactFieldRenderer } from "../types";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { BaseCompositeField } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";
import { FieldsHandlerService } from "../../FieldsHandlerService";
import { BaseCompositeFieldAttributes } from "../../state-managers";
import { BaseCompositeValue } from "../../state-managers";
import { FieldErrorMessage } from "./components/FieldErrorMessage";
import { MessageType } from "../../../messaging";

export const CompositeFieldRenderer = (({ kristaTypeField, options = {} }) => {
  const fieldState = kristaTypeField as BaseCompositeField<
    BaseCompositeFieldAttributes,
    BaseCompositeValue
  >;
  const [error, setError] = useState<string>(() => {
    if (!kristaTypeField.isValid) {
      return kristaTypeField.getErrors()[0];
    }
    return "";
  });
  useEffect(() => {
    kristaTypeField.dispatch = function onValueUpdate(newValue: KristaValue) {
      setError(kristaTypeField.getErrors()[0] || "");
    };
    return () => {
      kristaTypeField.dispatch = null;
    };
  }, [kristaTypeField]);

  const subFields = fieldState.getSubFields() || [];
  return (
    <>
      <Box
        sx={{
          position: "relative",
          "&:before": {
            content: subFields.length > 0 ? "''" : "none",
            border: "1px solid",
            borderColor: "divider",
            borderRight: 0,
            borderRadius: "4px 0 0 4px",
            width: 16,
            display: "block",
            position: "absolute",
            top: 8,
            left: 0,
            bottom: 0,
          },
        }}
      >
        <FormLabel
          component="legend"
          required={
            kristaTypeField.required && options.messageType !== MessageType.Inform
          }
          text={kristaTypeField.displayLabel}
          sx={{ paddingLeft: subFields.length > 0 ? "24px" : "0px" }}
          title={kristaTypeField.attributes.toolTip}
        />
        {subFields.length > 0 ? (
          <Box
            sx={{
              padding: "8px 0 8px 24px",
              "& > *": {
                marginBottom: "20px",
                marginRight:
                  fieldState.renderChildren === "inline" ? "20px" : "0px",
                display:
                  fieldState.renderChildren === "inline"
                    ? "inline-block"
                    : "block",
                verticalAlign: "top",
                "&:last-child": {
                  marginBottom: 0,
                },
              },
            }}
          >
            {subFields.map((subfieldState) => {
              const Component = FieldsHandlerService.getFieldRenderer(
                subfieldState,
                "react"
              );
              return Component ? (
                <Box
                  key={subfieldState.fieldId}
                  style={{
                    ...(subfieldState.isTabular()
                      ? { display: "block", minWidth: 375 }
                      : {}),
                    width:
                      subfieldState.isComplex() || subfieldState.readOnly
                        ? "auto"
                        : subfieldState.attributes.visualWidthPx,
                  }}
                >
                  <Component kristaTypeField={subfieldState} options={options} />
                </Box>
              ) : null;
            })}
          </Box>
        ) : null}
      </Box>
      <FieldErrorMessage error={error} />
    </>
  );
}) as ReactFieldRenderer;

CompositeFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.ADDRESS_FIELD:
    case FieldTypes.COMPOSITE_FIELD:
    case FieldTypes.ENTITY_FIELD:
    case FieldTypes.MULTI_FIELD:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
