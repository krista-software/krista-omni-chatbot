import { BaseCompositeField } from "./BaseCompositeField";
import { FieldTypes } from "../FieldTypes";
import { EntityFieldAttributes } from "../field-attributes/EntityFieldAttributes";
import { EntityValue } from "../field-values/EntityValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { EntityMeta } from "../../classes/entity/EntityMeta";
import { EntityValueJson, GenericObject } from "../types";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { consoleLog } from "../../../../common/utils";

export class EntityField extends BaseCompositeField<
  EntityFieldAttributes,
  EntityValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.ENTITY_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected getSubComplexFieldRawValue(
    newValue: GenericObject,
    fieldId: string
  ) {
    if (newValue) {
      return newValue["fields"] ? newValue["fields"][fieldId] : undefined;
    }
    return undefined;
  }

  protected recreateCompositeValue(): EntityValue {
    const entityValue = new EntityValue(this.value.meta);
    this.getSubFields().forEach((subField) => {
      entityValue.setFieldValue(subField.fieldId, subField.getKristaValue());
    });
    return entityValue;
  }

  protected createKristaValue(rawValue: EntityValueJson): EntityValue {
    let value = EntityValue.fromJSON(rawValue);
    consoleLog("29: EntityField: createKristaValue: ", { rawValue, value });
    if (!value) {
      value = new EntityValue(new EntityMeta(this.attributes.getEntityType()));
    }
    const fieldValue = EntityValue.getFieldValueJson(rawValue);
    if (fieldValue && Object.keys(fieldValue).length > 0) {
      this.getSubFields().forEach((subfield) => {
        value?.setFieldValue(
          subfield.fieldId,
          KristaTypeField.createFieldValue(
            subfield,
            fieldValue[subfield.fieldId]
          )
        );
      });
    }
    consoleLog("29: EntityField: createKristaValue: done", { rawValue, value });
    return value;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): EntityFieldAttributes {
    return new EntityFieldAttributes(_attributes);
  }
}
