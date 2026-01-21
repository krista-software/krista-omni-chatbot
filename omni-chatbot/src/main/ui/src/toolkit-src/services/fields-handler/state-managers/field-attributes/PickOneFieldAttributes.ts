import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { isDefined } from "../../../../common/utils";

export class PickOneFieldAttributes extends KristaFieldAttributes {
  public static readonly OPTIONS = "options"; // string[]
  protected readonly _options: string[];

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._options = attributes.get(PickOneFieldAttributes.OPTIONS);
  }

  get options(): string[] {
    return isDefined(this._options) ? this._options : [];
  }

  get hasOptions(): boolean {
    return this.options.length > 0;
  }
}
