import { NamedFieldJson } from "../types";
import { KristaFieldAttributes } from "./KristaFieldAttributes";

export abstract class BaseCompositeFieldAttributes extends KristaFieldAttributes {
  protected constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  abstract getSubfields(): NamedFieldJson[];
}
