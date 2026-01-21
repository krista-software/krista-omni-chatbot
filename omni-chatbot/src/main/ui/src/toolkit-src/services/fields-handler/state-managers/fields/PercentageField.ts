import { isDefined } from "../../../../common/utils";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { Priorities } from "../../Priorities";
import { FieldTypes } from "../FieldTypes";
import { NumberField } from "./NumberField";

export class PercentageField extends NumberField {
  protected static getPriority(field: KSDKFormField): Priorities {
    switch (field.fieldType) {
      case FieldTypes.PERCENTAGE_FIELD:
        return Priorities.SpecificType;
      default:
        return Priorities.NotSupported;
    }
  }
  protected formatValue(): string {
    const val = this.value.getValue();
    return isDefined(val)
      ? Math.round((val as number) * 10000) / 100 + "%"
      : "";
  }
}
