import { DataRow } from "./DataRow";
import { KristaFieldAttributes } from "../../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../field-values/KristaValue";
import { KristaTypeField } from "../KristaTypeField";
import { FieldsHandlerService } from "../../../FieldsHandlerService";
import { ValueJson } from "../../types";
import { ICompositeField } from "../types";
import { KSDKFormField } from "../../../../messaging/form/KSDKFormField";

export class TableFieldDataRow extends DataRow {
  getFieldStates(
    fields: KSDKFormField[],
    values: any,
    parent?: ICompositeField
  ): KristaTypeField<KristaFieldAttributes, KristaValue>[] {
    const fieldStates: KristaTypeField<KristaFieldAttributes, KristaValue>[] =
      [];
    fields.forEach((field) => {
      const kristaField = FieldsHandlerService.getFieldStateManager(
        field,
        parent
      );
      kristaField.isInsideTable = true;
      if (values && values[kristaField.fieldId] !== undefined) {
        // avoid recompute of parent for individual fields.
        // parent value will be recomputed after row is added.
        kristaField.setValue(values[kristaField.fieldId], false, false);
      }
      fieldStates.push(kristaField);
    });
    return fieldStates;
  }

  toResponse(): ValueJson {
    const response: ValueJson = {};
    this.fields.forEach((field) => {
      response[field.fieldId] = field.toResponse();
    });
    return response;
  }
}
