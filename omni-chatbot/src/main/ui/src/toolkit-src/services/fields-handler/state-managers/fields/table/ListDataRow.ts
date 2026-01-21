import { DataRow } from "./DataRow";
import { KristaFieldAttributes } from "../../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../field-values/KristaValue";
import { KristaTypeField } from "../KristaTypeField";
import { FieldsHandlerService } from "../../../FieldsHandlerService";
import { ValueJson } from "../../types";
import { ICompositeField } from "../types";
import { KSDKFormField } from "../../../../messaging/form/KSDKFormField";
import { isDefined } from "../../../../../common/utils";

export class ListFieldDataRow extends DataRow {
  // for List field,
  // fields - is always a single field array and
  // values - is the value for that field.
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
      if (isDefined(values)) {
        // avoid recompute of parent for individual fields.
        // parent value will be recomputed after row is added.
        kristaField.setValue(values, false, false);
      }
      fieldStates.push(kristaField);
    });
    return fieldStates;
  }

  toResponse(): any {
    const response: ValueJson = {};
    this.fields.forEach((field) => {
      response[field.fieldId] = field.toResponse();
    });
    return response;
  }
}
