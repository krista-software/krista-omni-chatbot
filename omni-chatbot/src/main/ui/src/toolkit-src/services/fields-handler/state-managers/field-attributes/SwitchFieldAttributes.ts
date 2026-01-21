import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { isDefined } from "../../../../common/utils";

export class SwitchFieldAttributes extends KristaFieldAttributes {
  public static readonly RENDER_AS_CHECKBOX = "renderAsCheckbox"; // boolean

  protected readonly _renderAsCheckbox: boolean;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._renderAsCheckbox = attributes.get(
      SwitchFieldAttributes.RENDER_AS_CHECKBOX
    );
  }

  get renderAsCheckbox(): boolean {
    return isDefined(this._renderAsCheckbox) ? this._renderAsCheckbox : false;
  }
}
