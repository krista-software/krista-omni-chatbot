import { isDefined } from "../../../../common/utils";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { EntityType } from "./EntityType";

export class EntityDefinition {
  constructor(
    readonly name: string,
    readonly fields: KSDKFormField[],
    readonly entityType: EntityType
  ) {}

  public static fromJSON(json: any): EntityDefinition | undefined {
    if (!isDefined(json)) {
      return undefined;
    }
    return new EntityDefinition(
      json["name"],
      KSDKFormField.fromJSONArray(Object.values(json["fields"])),
      EntityType.fromJSON(json["entityType"])!
    );
  }
}
