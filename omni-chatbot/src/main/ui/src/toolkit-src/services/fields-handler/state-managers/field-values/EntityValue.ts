import { EntityMeta } from "../../classes/entity/EntityMeta";
import { KristaValue } from "./KristaValue";
import { CompositeValue } from "./CompositeValue";
import { isDefined } from "../../../../common/utils";
import { EntityValueJson, ValueJson } from "../types";

export class EntityValue extends CompositeValue {
  private static readonly Meta = "meta";
  private static readonly Fields = "fields";

  constructor(
    readonly meta: EntityMeta,
    readonly values?: ValueJson,
    readonly textSummary?: string
  ) {
    super();
  }

  public toString(): string {
    return this.textSummary || "";
  }

  public getKey(): string {
    return this.meta.primaryKey || "";
  }

  public getValue(): any {
    return this.values;
  }

  public equals(value: KristaValue): boolean {
    return false;
  }

  public toResponse(): EntityValueJson | undefined {
    if (!this.meta && !this.values) {
      return undefined;
    }
    const jsonObj: Partial<EntityValueJson> = {};
    jsonObj[EntityValue.Meta] = this.meta.toJSON();
    const fields: EntityValueJson["fields"] = (jsonObj[EntityValue.Fields] =
      this.values || {});
    this.subfieldValue.forEach((subfieldValue, fieldId) => {
      fields[fieldId] = subfieldValue.toResponse();
    });
    return jsonObj as EntityValueJson;
  }

  public static isEntity(json: EntityValueJson | EntityValueJson[]): boolean {
    if (!isDefined(json)) {
      return false;
    }
    if (Array.isArray(json)) {
      return json.length > 0 ? isDefined(json[0][EntityValue.Meta]) : false;
    } else {
      return isDefined(json[EntityValue.Meta]);
    }
  }

  public static getFieldValueJson(json: ValueJson): EntityValueJson["fields"] {
    return (json && json[EntityValue.Fields]) || JSON.parse("{}");
  }

  public static fromJSON(json: EntityValueJson): EntityValue | undefined {
    if (!json || !json[EntityValue.Meta]) {
      return undefined;
    }
    return new EntityValue(
      EntityMeta.fromJSON(json[EntityValue.Meta]),
      json[EntityValue.Fields]
    );
  }

  public static fromJSONArray(jsonArray: EntityValueJson[]): EntityValue[] {
    if (!jsonArray) {
      return [];
    }
    const entities: EntityValue[] = [];
    jsonArray.forEach((jsonObj) => {
      const entity = this.fromJSON(jsonObj);
      if (entity) {
        entities.push(entity);
      }
    });
    return entities;
  }
}
