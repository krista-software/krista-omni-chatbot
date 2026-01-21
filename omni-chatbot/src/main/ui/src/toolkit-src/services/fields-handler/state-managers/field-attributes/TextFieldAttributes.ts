import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { isDefined } from "../../../../common/utils";

export class TextFieldAttributes extends KristaFieldAttributes {
  public static readonly MAX_LENGTH = "maxLength"; // integer
  public static readonly MIN_LENGTH = "minLength"; // integer
  public static readonly TRIM = "trim"; // boolean

  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  get min(): number {
    return this.get(TextFieldAttributes.MIN_LENGTH) || 0;
  }

  get max(): number {
    return this.get(TextFieldAttributes.MAX_LENGTH) || Number.MAX_VALUE;
  }

  get trim(): boolean {
    const trim = this.get(TextFieldAttributes.TRIM);
    return isDefined(trim) ? trim : true;
  }

  get doAutoCapitalization(): boolean {
    return false;
    // return this.fieldState.fieldType === "ProperNoun" || this.fieldState.fieldType === "Person" ||
    //   this.fieldState.fieldType === "Street" || this.fieldState.fieldType === "Street2";
  }
}
