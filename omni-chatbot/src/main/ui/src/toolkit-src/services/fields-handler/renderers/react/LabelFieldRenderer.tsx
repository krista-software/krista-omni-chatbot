import React from "react";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../../state-managers";
import { ReactFieldRenderer } from "../types";
import { KristaTypeField } from "../../state-managers";
import { KristaFieldAttributes } from "../../state-managers";
import { KristaValue } from "../../state-managers";
import { FormLabel } from "./components/FormLabel";

export const LabelFieldRenderer = (({ kristaTypeField }) => {
  return <FormLabel text={kristaTypeField.displayLabel} title={kristaTypeField.attributes.toolTip} />;
}) as ReactFieldRenderer;

LabelFieldRenderer.getPriority = (
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) => {
  switch (field.fieldType) {
    case FieldTypes.LABEL:
      return Priorities.SpecificType;
    default:
      return Priorities.NotSupported;
  }
};
