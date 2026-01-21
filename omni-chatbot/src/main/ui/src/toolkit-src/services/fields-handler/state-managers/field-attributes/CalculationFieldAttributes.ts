import { KristaFieldAttributes } from "./KristaFieldAttributes";
export class CalculationFieldAttributes extends KristaFieldAttributes {
  public static readonly CALCULATION = "calculation"; // Expression
  public static readonly INVISIBLE = "invisible"; // boolean

  protected readonly _expressionString: string;
  protected readonly _invisible: boolean;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._expressionString = attributes.get(
      CalculationFieldAttributes.CALCULATION
    );
    this._invisible = attributes.get(CalculationFieldAttributes.INVISIBLE);
  }

  get expressionString(): string {
    return this._expressionString;
  }

  get isInvisible(): boolean {
    return this._invisible || false;
  }
}
