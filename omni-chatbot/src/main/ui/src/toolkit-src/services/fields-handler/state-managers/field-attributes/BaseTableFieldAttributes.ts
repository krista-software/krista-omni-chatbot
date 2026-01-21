import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { KristaFieldAttributes } from "./KristaFieldAttributes";

export abstract class BaseTableFieldAttributes extends KristaFieldAttributes {
  public static readonly ALLOW_ADD = "allowAdd";
  public static readonly ALLOW_DELETE = "allowDelete";

  protected constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  get allowAdd(): boolean {
    return this.get(BaseTableFieldAttributes.ALLOW_ADD) || false;
  }

  get allowDelete(): boolean {
    return this.get(BaseTableFieldAttributes.ALLOW_DELETE) || false;
  }

  public abstract getColumns(): KSDKFormField[];

  public abstract getPrimaryKeyId(): string;
}
