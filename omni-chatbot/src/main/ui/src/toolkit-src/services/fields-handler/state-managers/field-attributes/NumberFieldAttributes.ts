import { isDefined } from "../../../../common/utils";
import { KristaFieldAttributes } from "./KristaFieldAttributes";

export class NumberFieldAttributes extends KristaFieldAttributes {
  public static readonly MIN_VALUE = "minValue"; // double
  public static readonly MAX_VALUE = "maxValue"; // double
  public static readonly PATTERN = "formatPattern"; // string

  protected readonly _minValue: number;
  protected readonly _maxValue: number;
  protected readonly _pattern: string;
  protected readonly _hasPattern: boolean;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._minValue = attributes.get(NumberFieldAttributes.MIN_VALUE);
    this._maxValue = attributes.get(NumberFieldAttributes.MAX_VALUE);

    const pattern = attributes.get(NumberFieldAttributes.PATTERN);
    this._pattern = isDefined(pattern) ? pattern : "General";
    this._hasPattern = isDefined(pattern);
  }

  get minValue(): number {
    return this._minValue;
  }

  get maxValue(): number {
    return this._maxValue;
  }

  get pattern(): string {
    return this._pattern;
  }

  get hasPattern(): boolean {
    return this._hasPattern;
  }
}
