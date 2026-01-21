import { TextFieldAttributes } from "./TextFieldAttributes";

export class IdentifierFieldAttributes extends TextFieldAttributes {
  public static readonly PATTERN = "pattern"; // string

  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  get pattern(): string {
    return this.get(IdentifierFieldAttributes.PATTERN) || undefined;
  }
}
