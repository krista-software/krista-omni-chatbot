import { BaseCompositeFieldAttributes } from "./BaseCompositeFieldAttributes";
import { addressFields } from "./addressFields";
import { NamedFieldJson } from "../types";

export class AddressFieldAttributes extends BaseCompositeFieldAttributes {
  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  getSubfields(): NamedFieldJson[] {
    return addressFields;
  }
}
