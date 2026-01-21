import { NamedFieldJson } from "../types";
import { BaseCompositeFieldAttributes } from "./BaseCompositeFieldAttributes";

export class CompositeFieldAttributes extends BaseCompositeFieldAttributes {
  public static readonly SUB_FIELDS = "subfields"; // this is deprecated with the below fields.
  public static readonly FIELDS = "fields"; // new

  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  getSubfields(): NamedFieldJson[] {
    return (
      this.get(CompositeFieldAttributes.FIELDS) ||
      this.get(CompositeFieldAttributes.SUB_FIELDS)
    );
  }

  isDeprecated(): boolean {
    return this.get(CompositeFieldAttributes.FIELDS)
      ? false
      : !!this.get(CompositeFieldAttributes.SUB_FIELDS);
  }
}
