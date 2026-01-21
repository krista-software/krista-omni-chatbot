import { isDefined } from "../../../../common/utils";
import { KristaFieldAttributes } from "./KristaFieldAttributes";

export class CheckboxesFieldAttributes extends KristaFieldAttributes {
  public static readonly OPTIONS = "options"; // string[]
  public static readonly MIN_SELECTION = "minSelection"; // number
  public static readonly MAX_SELECTION = "maxSelection"; // number

  protected readonly _options: string[];
  protected readonly _minSelection: number;
  protected readonly _maxSelection: number;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._options = attributes.get(CheckboxesFieldAttributes.OPTIONS);
    this._minSelection = attributes.get(
      CheckboxesFieldAttributes.MIN_SELECTION
    );
    this._maxSelection = attributes.get(
      CheckboxesFieldAttributes.MAX_SELECTION
    );
  }

  get options(): string[] {
    return isDefined(this._options) ? this._options : [];
  }

  get hasOptions(): boolean {
    return this._options && this._options.length > 0;
  }

  get minSelection(): number {
    return isDefined(this._minSelection) ? this._minSelection : -1;
  }

  get maxSelection(): number {
    return isDefined(this._maxSelection)
      ? this._maxSelection
      : Number.MAX_VALUE;
  }
}
