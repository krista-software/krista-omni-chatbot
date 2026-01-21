import { KSDKFormField } from "../messaging";
import { Priorities } from "./Priorities";
import { KristaValue } from "./state-managers";
import { KristaFieldAttributes } from "./state-managers";
import {
  KristaTypeField,
  DateField,
  TimeField,
  DateRangeField,
  DateTimeRangeField,
  EmailField,
  IdentifierField,
  SwitchField,
  FileField,
  CameraField,
  LocationField,
  RatingField,
  PickOneField,
  CheckboxesField,
  RichTextField,
  SelectionField,
  AutoCapitalizeField,
  ParagraphField,
  PercentageField,
  PhoneField,
  CalculationField,
  NumberField,
  MultiField,
  EntityField,
  CompositeField,
  TableField,
  ListField,
  AddressField,
  TextField,
  UnknownField,
  StreamField,
  FieldTypes,
} from "./state-managers";
import { ICompositeField } from "./state-managers/fields/types";
import { consoleLog } from "../../common/utils";

export abstract class StateManager {
  public static getStateManager<
    T extends KristaTypeField<KristaFieldAttributes, KristaValue>
  >(field: KSDKFormField, parent?: ICompositeField): T {
    return this.createFromField(field, parent);
  }

  private static getFieldClass(field: KSDKFormField): any {
    const allFields: { field: any }[] = [
      { field: DateField },
      { field: TimeField },
      { field: DateRangeField },
      { field: DateTimeRangeField },
      { field: EmailField },
      { field: IdentifierField },
      { field: SwitchField },
      { field: FileField },
      { field: CameraField },
      { field: LocationField },
      { field: RatingField },
      { field: PickOneField },
      { field: CheckboxesField },
      { field: RichTextField },
      { field: SelectionField },
      { field: AutoCapitalizeField },
      { field: ParagraphField },
      { field: PhoneField },
      { field: CalculationField },
      { field: PercentageField },
      { field: NumberField },
      { field: MultiField },
      { field: EntityField },
      { field: CompositeField },
      { field: TableField },
      { field: ListField },
      { field: AddressField },
      { field: TextField },
      { field: StreamField },
    ];
    const priorities: {
      priority: Priorities;
      field: any;
    }[] = allFields
      .map((fieldObj) => {
        const fieldClass = fieldObj.field;
        if (fieldClass.getPriority) {
          const pr = fieldClass.getPriority(field) as Priorities;
          return {
            priority: fieldClass.getPriority(field) as Priorities,
            field: fieldClass,
          };
        } else {
          return {
            priority: Priorities.NotSupported,
            field: fieldClass,
          };
        }
      })
      .filter(
        (priorityObj) => priorityObj.priority !== Priorities.NotSupported
      );
    if (priorities.length > 0) {
      let selected = priorities[0];
      priorities.forEach((item) => {
        if (item.priority > selected.priority) {
          selected = item;
        }
      });
      return selected.field;
    }
    return undefined;
  }

  private static createFromField<
    T extends KristaTypeField<KristaFieldAttributes, KristaValue>
  >(field: KSDKFormField, parent?: ICompositeField): T {
    let fieldClass = this.getFieldClass(field);
    let fieldType = field.fieldType;
    if (!fieldClass) {
      fieldType = FieldTypes.UNKNOWN_FIELD;
      fieldClass = UnknownField;
    }
    const FieldClass: new (
      fieldType: string,
      field: KSDKFormField,
      parent?: ICompositeField
    ) => T = fieldClass;
    consoleLog("1 creating field state", {
      fieldType,
      field: field.name,
      parent,
    });
    const fieldState = new FieldClass(fieldType, field, parent);
    consoleLog("1 creating field state done", {
      fieldType,
      field: field.name,
      parent,
    });
    return fieldState;
  }
}
