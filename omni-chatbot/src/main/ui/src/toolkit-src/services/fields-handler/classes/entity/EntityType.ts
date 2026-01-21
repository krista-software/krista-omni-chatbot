import { isDefined } from "../../../../common/utils";
import { EntityTypeJson } from "../../state-managers/types";

export class EntityType {
  private readonly _entityName: string;
  constructor(public readonly source: EntityTypeJson) {
    this._entityName = source["entityName"];
  }

  get entityName(): string {
    return this._entityName;
  }

  toJSON(): EntityTypeJson {
    return this.source;
  }

  static fromJSON(jsonObj: EntityTypeJson): EntityType | undefined {
    if (!isDefined(jsonObj)) {
      return undefined;
    }
    return new EntityType(jsonObj);
  }
}
