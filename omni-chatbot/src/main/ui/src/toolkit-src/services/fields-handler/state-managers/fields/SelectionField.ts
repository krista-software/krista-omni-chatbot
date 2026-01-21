import { KristaTypeField } from "./KristaTypeField";
import { SelectionFieldAttributes } from "../field-attributes/SelectionFieldAttributes";
import { EntityValue } from "../field-values/EntityValue";
import { SelectionValue } from "../field-values/SelectionValue";
import { EntityMeta } from "../../classes/entity/EntityMeta";
import { FieldTypes } from "../FieldTypes";
import { EntityValueJson, ValueJson } from "../types";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { ICompositeField } from "./types";
import {
  IEntitySearchResult,
  filterSearchResultWithProperFieldFormat,
} from "../../renderers/react/entity/EntitySearchResult";

export class SelectionField extends KristaTypeField<
  SelectionFieldAttributes,
  SelectionValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): SelectionFieldAttributes {
    return new SelectionFieldAttributes(_attributes);
  }

  // setValue(newValue: any | any[]) {
  //   if (!newValue) {
  //     super.setValue(newValue);
  //     return;
  //   }

  //   super.setValue(Array.isArray(newValue) ? newValue : [newValue]);
  // }

  // public toResponse(): EntityValueJson | EntityValueJson[] | undefined {
  //   const res = this.value.toResponse();
  //   if (this.attributes.entityMeta.isMultiSelect) {
  //     return res;
  //   }
  //   if (res) {
  //     return res[0];
  //   }
  //   return undefined;
  // }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.ENTITY_SELECTION) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createKristaValue(
    rawValue: EntityValueJson | EntityValueJson[] | ValueJson[]
  ): SelectionValue {
    if (!rawValue) {
      return new SelectionValue(undefined);
    }
    if (EntityValue.isEntity(rawValue as any)) {
      if (this.attributes.entityMeta.isMultiSelect) {
        return new SelectionValue(
          getEntityValues(
            this.attributes.entityMeta.entityDefinition!.fields,
            rawValue as EntityValueJson[]
          )
        );
      }
      return new SelectionValue(
        getEntityValues(this.attributes.entityMeta.entityDefinition!.fields, [
          rawValue as EntityValueJson,
        ])[0]
      );
    } else {
      // deprecated
      // this is just for readonly
      // only to show past existing data before entity
      const entityValues = (rawValue as ValueJson[]).map((jsonObj) => {
        return new EntityValue(
          EntityMeta.createFromKeys(jsonObj["key"]),
          undefined,
          jsonObj["value"]
        );
      });
      return new SelectionValue(entityValues);
    }
  }
}

function getEntityValues(
  fields: KSDKFormField[],
  values: EntityValueJson[]
): EntityValue[] {
  const valuesWithTextSummary: IEntitySearchResult[] =
    filterSearchResultWithProperFieldFormat(fields, values);
  const entityValues: EntityValue[] = [];
  valuesWithTextSummary.forEach((val) => {
    entityValues.push(
      new EntityValue(
        EntityMeta.fromJSON(val.value.meta),
        val.value.fields,
        val.textSummary
      )
    );
  });
  return entityValues;
}
