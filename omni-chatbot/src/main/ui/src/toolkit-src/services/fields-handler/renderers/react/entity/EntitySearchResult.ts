import { KSDKFormField } from "../../../../messaging/form/KSDKFormField";
import { FieldsHandlerService } from "../../../FieldsHandlerService";
import { KristaFieldAttributes } from "../../../state-managers/field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../../state-managers/field-values/KristaValue";
import { KristaTypeField } from "../../../state-managers/fields/KristaTypeField";
import { EntityValueJson } from "../../../state-managers/types";
import { recursivelySetFieldRedOnlyStatus } from "../../../utils/fields";

export interface IEntitySearchResult {
  value: EntityValueJson;
  textSummary: string;
  fields: KristaTypeField<KristaFieldAttributes, KristaValue>[];
}

export class EntitySearchResult {
  private static EntityDefinition = "entityDefinition";
  private static Result = "result";

  constructor(public readonly entities: IEntitySearchResult[]) {}

  static fromJSON(json: any): EntitySearchResult | undefined {
    if (!json) {
      return undefined;
    }

    const entityFields = Object.values(
      json[EntitySearchResult.EntityDefinition].fields
    ); // Object.values works for array and object
    if (entityFields) {
      return new EntitySearchResult(
        filterSearchResultWithProperFieldFormat(
          KSDKFormField.fromJSONArray(entityFields),
          json[EntitySearchResult.Result]
        )
      );
    }
  }
}
// we are getting the entity field attributes from namedFields, and based on that we filter the fields which are secured, and not
// to be included in to string
// We are creating proper KristaField from the value fetched from result, so in this way not just Date field but
// every krista field will be formatted properly
export function filterSearchResultWithProperFieldFormat(
  fields: KSDKFormField[],
  entities: EntityValueJson[]
): IEntitySearchResult[] {
  const entityResults: IEntitySearchResult[] = [];
  // const entities = EntityValue.fromJSONArray(values);
  for (const entity of entities) {
    const stringifiedValues = [];
    const entityFields: KristaTypeField<KristaFieldAttributes, KristaValue>[] =
      [];
    for (const namedField of fields) {
      const kristaTypeField =
        FieldsHandlerService.getFieldStateManager(namedField);
      let fieldValue = (entity.fields || {})[namedField.name];
      if (fieldValue?.replaceAll) {
        fieldValue = fieldValue?.replaceAll("\n", "");
      }
      kristaTypeField.setValue(fieldValue, false, false);
      recursivelySetFieldRedOnlyStatus(kristaTypeField, true);
      entityFields.push(kristaTypeField);
      if (
        !kristaTypeField.isTabular() &&
        !namedField.attributes.get("isSecured") &&
        namedField.options.get("includeInSummary")?.value &&
        kristaTypeField.formattedValue
      ) {
        stringifiedValues.push(kristaTypeField.formattedValue);
      }
    }
    entityResults.push({
      textSummary: "[" + stringifiedValues.join(", ") + "]",
      value: entity,
      fields: entityFields,
    });
  }
  return entityResults;
}
