import i18next from "i18next";
import { BaseCompositeFieldAttributes } from "../field-attributes/BaseCompositeFieldAttributes";
import { KristaFieldAttributes } from "../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../field-values/KristaValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { BaseCompositeValue } from "../field-values/BaseCompositeValue";
import { FieldTypes } from "../FieldTypes";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { FieldsHandlerService } from "../../FieldsHandlerService";
import { AddressField } from "./AddressField";
import { GenericObject } from "../types";
import { consoleLog } from "../../../../common/utils";

export abstract class BaseCompositeField<
    T extends BaseCompositeFieldAttributes,
    V extends BaseCompositeValue
  >
  extends KristaTypeField<T, V>
  implements ICompositeField
{
  private readonly subfieldMap = new Map<
    string,
    KristaTypeField<KristaFieldAttributes, KristaValue>
  >();
  isChildrenValid = true;
  renderChildren: "inline" | "block" = "block";
  protected constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
    consoleLog("3 BaseCompositeField: prepareSubfields: start");
    this.prepareSubfields();
    consoleLog("3 BaseCompositeField: prepareSubfields: done");
  }

  private prepareSubfields() {
    const subfieldsJson = this.attributes.getSubfields();
    const isAddressField = this instanceof AddressField;
    if (subfieldsJson) {
      subfieldsJson.forEach((subfieldJson: any) => {
        if (isAddressField) {
          subfieldJson["displayLabel"] = i18next.t(
            `krista.address.${subfieldJson["name"]}`
          );
        }
        const nameField = KSDKFormField.fromJSON(subfieldJson);
        if (nameField) {
          nameField.readOnly = this.readOnly;
          // since Address subfields are statically maintained, the "required" property cannot be hard-coded on them.
          // so we need to set that property on subfields based on the parent's(Address field) required property.
          if (
            isAddressField &&
            this.required &&
            ["street", "city", "country", "postalcode"].includes(
              nameField.name.toLowerCase()
            )
          ) {
            nameField.required = true;
          }
          const subfield = FieldsHandlerService.getFieldStateManager(
            nameField,
            this
          );
          if (subfield) {
            this.addSubfield(subfield);
          }
        }
      });
    }
  }

  isComposite(): boolean {
    return true;
  }

  public validate(): boolean {
    this.validators.validate(this.toResponse());
    let isSubfieldValid = true;
    this.getSubFields().forEach((subfield) => {
      if (!subfield.validate()) {
        isSubfieldValid = false;
      }
    });
    this.isChildrenValid = isSubfieldValid;
    this.dispatchData();
    return this.isValid;
  }

  protected getSubComplexFieldRawValue(
    newValue: GenericObject,
    fieldId: string
  ) {
    if (newValue) {
      return newValue[fieldId];
    }
    return undefined;
  }

  setValue(newValue: GenericObject) {
    consoleLog("4 BaseCompositeField: setValue: start", newValue);
    const compositeValue = this.createKristaValue(newValue);
    this.getSubFields().forEach((subfield) => {
      if (subfield.isComplex()) {
        const subComplexFieldValue = this.getSubComplexFieldRawValue(
          newValue,
          subfield.fieldId
        );
        consoleLog("30: nested complex field: start", {
          val: subComplexFieldValue,
          subfield: subfield.fieldId,
        });
        subfield.setValue(subComplexFieldValue, false, false);
        consoleLog("30: nested complex field: done");
      } else {
        consoleLog(
          "11 BaseCompositeField: subfield: setInternalFieldValue: start",
          subfield.fieldId
        );
        const fieldValue =
          compositeValue.getFieldValue(subfield.fieldId) ??
          KristaTypeField.createFieldValue(subfield, undefined);
        consoleLog(subfield.fieldId, " - field value - ", fieldValue);
        KristaTypeField.setInternalFieldValue(subfield, fieldValue, false);
        consoleLog(
          "11 BaseCompositeField: subfield: setInternalFieldValue: done",
          subfield.fieldId
        );
      }
    });
    consoleLog(
      "13: BaseCompositeField: call setInternalValue start",
      compositeValue.toResponse()
    );
    this.setInternalValue(compositeValue);
    consoleLog(
      "13: BaseCompositeField: call setInternalValue done",
      compositeValue.toResponse()
    );
    consoleLog(
      "4 BaseCompositeField: setValue: done",
      compositeValue.toResponse()
    );
  }

  // setInternalValue(newValue: V, recomputeParentValue = true) {
  //   this.getSubFields().forEach((subfield) => {
  //     const fieldValue =
  //       newValue.getFieldValue(subfield.fieldId) ??
  //       KristaTypeField.createFieldValue(subfield, undefined);
  //     KristaTypeField.setInternalFieldValue(subfield, fieldValue, false);
  //   });
  //   super.setInternalValue(newValue, recomputeParentValue);
  // }

  getSubFields(): KristaTypeField<KristaFieldAttributes, KristaValue>[] {
    return (this.subfieldMap && Array.from(this.subfieldMap.values())) || [];
  }

  getSubField(
    fieldId: string
  ): KristaTypeField<KristaFieldAttributes, KristaValue> | undefined {
    return this.subfieldMap.get(fieldId);
  }

  getSubFieldValue(fieldId: string): KristaValue | undefined {
    return this.getSubField(fieldId)?.getKristaValue();
  }

  get isValid(): boolean {
    return this.validators.isValid && this.isChildrenValid;
  }

  // setSubFieldValue(
  //   fieldId: string,
  //   value: number | string | JSON | JSON[] | Omit<DateRangeJson, "type">
  // ) {
  //   this.getSubField(fieldId)?.setValue(value);
  // }

  addSubfield(field: KristaTypeField<KristaFieldAttributes, KristaValue>) {
    this.subfieldMap.set(field.fieldId, field);
    this.value.setFieldValue(field.fieldId, field.getKristaValue());
  }

  protected abstract recreateCompositeValue(): V;

  recomputeValue /*updatedField: KristaTypeField<KristaFieldAttributes, KristaValue>,
    prevValue: KristaValue,
    newValue: KristaValue*/() {
    consoleLog(
      "BaseCompositeField: recomputeValue old value",
      this.value.toResponse()
    );
    const newValue = this.recreateCompositeValue();
    consoleLog(
      "BaseCompositeField: recomputeValue new value",
      newValue.toResponse()
    );
    consoleLog(
      "16: BaseCompositeField: call setInternalValue: start: ",
      newValue.toResponse()
    );
    this.setInternalValue(newValue);
    consoleLog(
      "16: BaseCompositeField: call setInternalValue: end: ",
      newValue.toResponse()
    );
  }
}
