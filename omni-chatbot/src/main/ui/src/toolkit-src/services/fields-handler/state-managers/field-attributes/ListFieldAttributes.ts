import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { BaseTableFieldAttributes } from "./BaseTableFieldAttributes";

export class ListFieldAttributes extends BaseTableFieldAttributes {
  public static readonly LIST_FIELD = "field";
  private columns: KSDKFormField[] = [];

  constructor(attributes: Map<string, any>, readOnly = false, label: string) {
    super(attributes);
    const columnField = [this.get(ListFieldAttributes.LIST_FIELD)];
    columnField.forEach((fieldJson) => {
      fieldJson["name"] = fieldJson["name"] || label;
      const field = KSDKFormField.fromJSON(fieldJson);
      if (field) {
        field.readOnly = readOnly;
        this.columns.push(field);
      }
    });
  }

  getPrimaryKeyId(): string {
    return "";
  }

  public getColumns(): KSDKFormField[] {
    return this.columns;
  }
}
