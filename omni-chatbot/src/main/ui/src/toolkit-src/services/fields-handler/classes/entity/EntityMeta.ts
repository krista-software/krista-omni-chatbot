import { EntityMetaJson } from "../../state-managers/types";
import { EntityType } from "./EntityType";

export class EntityMeta {
  private static readonly TypeEntityMeta_PrimaryKey = "primaryKey";
  private static readonly TypeEntityMeta_EntityType = "entityType";

  constructor(
    public readonly entityType?: EntityType,
    public readonly primaryKey?: string
  ) {}

  toJSON(): EntityMetaJson {
    const jsonObj = JSON.parse("{}");
    if (this.primaryKey) {
      jsonObj[EntityMeta.TypeEntityMeta_PrimaryKey] = this.primaryKey;
    }

    if (this.entityType) {
      jsonObj[EntityMeta.TypeEntityMeta_EntityType] = this.entityType.toJSON();
    }
    return jsonObj;
  }

  static createFromKeys(primaryKey: string): EntityMeta {
    return new EntityMeta(undefined, primaryKey);
  }

  static fromJSON(jsonObj: EntityMetaJson): EntityMeta {
    return new EntityMeta(
      EntityType.fromJSON(jsonObj[EntityMeta.TypeEntityMeta_EntityType]!),
      jsonObj[EntityMeta.TypeEntityMeta_PrimaryKey]
    );
  }

  static fromJSONArray(jsonArray: EntityMetaJson[]): EntityMeta[] {
    if (!jsonArray) {
      return [];
    }

    const values: EntityMeta[] = [];
    jsonArray.forEach((jsonObj) => {
      values.push(this.fromJSON(jsonObj));
    });
    return values;
  }
}
