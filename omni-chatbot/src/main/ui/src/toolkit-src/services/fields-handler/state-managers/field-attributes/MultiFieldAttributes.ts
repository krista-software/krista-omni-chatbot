import { NamedFieldJson } from "../types";
import { BaseCompositeFieldAttributes } from "./BaseCompositeFieldAttributes";

export class MultiFieldAttributes extends BaseCompositeFieldAttributes {
  public static readonly FIELDS = "fields";

  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  getSubfields(): NamedFieldJson[] {
    return this.get(MultiFieldAttributes.FIELDS);
  }
}
