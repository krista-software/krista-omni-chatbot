import { BaseCompositeFieldAttributes } from "./BaseCompositeFieldAttributes";
import { EntityType } from "../../classes/entity/EntityType";
import { EntityDefinitionJson, NamedFieldJson } from "../types";

export class EntityFieldAttributes extends BaseCompositeFieldAttributes {
  public static readonly EntityDefinition = "entityDefinition";
  public static readonly EntityType = "entityTypeDomain";
  public static readonly EntityFields = "fields";
  public static readonly EntityName = "entityName";

  readonly _entityType: EntityType | undefined = undefined;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._entityType = EntityType.fromJSON(
      attributes.get(EntityFieldAttributes.EntityType)
    );
  }

  getEntityDefinition(): EntityDefinitionJson {
    return this.get(EntityFieldAttributes.EntityDefinition);
  }

  getEntityType(): EntityType | undefined {
    return this._entityType;
  }

  getEntityName(): string {
    return this._entityType?.entityName ?? "";
  }

  getSubfields(): NamedFieldJson[] {
    const entityDefinition = this.getEntityDefinition();
    if (!entityDefinition) {
      return [];
    }
    return Object.values(entityDefinition[EntityFieldAttributes.EntityFields]); // Object.values works for array and object
  }
}
