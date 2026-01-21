import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { EntitySelectorMeta } from "../../classes/entity/EntitySelectorMeta";

export class SelectionFieldAttributes extends KristaFieldAttributes {
  public readonly entityMeta: EntitySelectorMeta;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this.entityMeta = new EntitySelectorMeta(attributes);
  }
}
