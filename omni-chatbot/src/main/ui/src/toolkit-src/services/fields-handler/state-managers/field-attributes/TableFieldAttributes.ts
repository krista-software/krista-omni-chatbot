import { BaseTableFieldAttributes } from "./BaseTableFieldAttributes";
import { TableMeta } from "../../classes/TableMeta";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class TableFieldAttributes extends BaseTableFieldAttributes {
  public static readonly META = "meta";
  public static readonly META_COLUMNS = "columns";
  public static readonly META_ENTITY = "entity";

  public readonly tableMeta: TableMeta;

  constructor(attributes: Map<string, any>, readOnly = false) {
    super(attributes);
    this.tableMeta = TableMeta.fromJSON(
      attributes.get(TableFieldAttributes.META),
      readOnly
    );
  }

  public getPrimaryKeyId(): string {
    return this.tableMeta.entityFieldId;
  }

  public getColumns(): KSDKFormField[] {
    return this.tableMeta.columns;
  }
}
