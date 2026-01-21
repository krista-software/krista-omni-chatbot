import { KSDKFormField } from "./../../../messaging/form/KSDKFormField";
import { v4 as uuidv4 } from "uuid";
import i18next from "i18next";

import { KristaFieldAttributes } from "../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../field-values/KristaValue";
import { Priorities } from "../../Priorities";
import {
  FieldValidators,
  getFieldValidators,
} from "../validators/FieldValidators";
import {
  CameraFieldJson,
  DateRangeJson,
  EntityValueJson,
  GenericObject,
  LocationValueJson,
  PhoneNumberJson,
} from "../types";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { consoleLog } from "../../../../common/utils";

export type FieldValue =
  | undefined
  | number
  | string
  | JSON
  | JSON[]
  | string[]
  | boolean
  | CameraFieldJson
  | PhoneNumberJson
  | LocationValueJson
  | EntityValueJson[]
  | EntityValueJson
  | GenericObject
  | Omit<DateRangeJson, "type">;

export abstract class KristaTypeField<
  T extends KristaFieldAttributes,
  V extends KristaValue
> {
  public readonly objectId = uuidv4();
  private readonly _attributes: T;
  private _value: V;
  private _formattedValue: string;
  private _required = false;
  public dispatch: ((newValue: any, onSubmit?: boolean) => void) | null = null;
  protected validators = new FieldValidators();
  public isInsideTable = false;

  public readonly fieldId: string;
  public readonly label: string;
  public readonly displayLabel: string;
  public readOnly: boolean;
  protected readonly _attributesMap: Map<string, any>;
  protected readonly _options: Map<string, any>;

  protected static getPriority(field: KSDKFormField): Priorities {
    return Priorities.NotSupported;
  }

  protected constructor(
    public readonly fieldType: FieldTypes,
    public readonly field: KSDKFormField,
    protected readonly parent?: ICompositeField
  ) {
    this.fieldId = field.name;
    this.label = field.name;
    this.displayLabel = field.displayName || field.name;
    this.readOnly = field.readOnly;
    this._attributesMap = field.attributes;
    this._options = field.options;
    this._required = field.required;
    this._attributes = this.createAttributes(this._attributesMap);
    consoleLog("2 createKristaValue with undefined", {
      fieldType,
      name: field.name,
    });
    this._value = this.createKristaValue(undefined);
    this._formattedValue = this.formatValue();
    consoleLog("2 createKristaValue with undefined done", {
      fieldType,
      name: field.name,
      value: this._value.toResponse(),
    });
    // TODO are validators required in read only mode?
    if (!this.readOnly) {
      const _validators = getFieldValidators(
        this.field,
        this.label,
        this._attributesMap
      );
      _validators.forEach((_validator) => {
        this.validators.addValidator(_validator);
      });
    }
  }

  protected get value(): V {
    return this._value;
  }

  protected setInternalValue(newValue: V, recomputeParentValue = true) {
    consoleLog("12 setInternalValue: start", {
      recomputeParentValue,
      parent: this.parent,
      field: this.fieldId,
      value: newValue.toResponse(),
    });
    if (!this._value || !this._value.equals(newValue)) {
      const prevValue = this._value;
      this._value = newValue;
      this._formattedValue = this.formatValue();
      consoleLog("10: recomputeValue: start", {
        recomputeParentValue,
        field: this.fieldId,
        parent: this.parent,
      });
      if (recomputeParentValue && this.parent) {
        this.parent.recomputeValue(this, prevValue, newValue);
      }
      consoleLog("10: recomputeValue: done", {
        recomputeParentValue,
        field: this.fieldId,
        parent: this.parent,
      });
    }
    consoleLog("12 setInternalValue: done", {
      recomputeParentValue,
      parent: this.parent,
      field: this.fieldId,
      value: newValue.toResponse(),
    });
    // TODO revisit if this is causing any issues
    // This is moved outside if condition
    // because of text trim use case
    this.dispatchData();
  }

  protected dispatchData(onSubmit?: boolean) {
    if (this.dispatch && typeof this.dispatch === "function") {
      this.dispatch(this.value, onSubmit);
    }
  }

  protected abstract createKristaValue(rawValue: any): V;

  protected processKristaValue(rawValue: FieldValue): FieldValue {
    return rawValue;
  }

  protected formatValue(): string {
    return this.value.toString();
  }

  public setValue(
    newValue: FieldValue,
    process = true,
    recomputeParentValue = true
  ) {
    let processedValue = newValue;
    if (process) {
      processedValue = this.processKristaValue(newValue);
    }
    this.setInternalValue(
      this.createKristaValue(processedValue),
      recomputeParentValue
    );
  }

  public validate(): boolean {
    this.validators.validate(this.toResponse());
    this.dispatchData();
    return this.isValid;
  }

  get isValid(): boolean {
    return this.validators.isValid;
  }

  public getErrors(): string[] {
    if (this.isValid) {
      return [];
    }
    return this.validators.errors.length > 0
      ? [...this.validators.errors]
      : [i18next.t("krista.general.enterCorrectValues")];
  }

  protected abstract createAttributes(_attributes: Map<string, any>): T;

  public get formattedValue(): string {
    return this._formattedValue;
  }

  public get attributes(): T {
    return this._attributes;
  }

  public get options(): Map<string, any> {
    return this._options;
  }

  public get required(): boolean {
    return this._required;
  }

  public isComposite(): boolean {
    return false;
  }

  public isTabular(): boolean {
    return false;
  }

  public isComplex(): boolean {
    return this.isComposite() || this.isTabular();
  }

  public get hasValue(): boolean {
    if (this._value) {
      const val = this._value.getValue();
      return val !== undefined && val !== null;
    }
    return false;
  }

  public getKristaValue(): V {
    return this._value;
  }

  public toResponse(): any {
    return this._value?.toResponse();
  }

  protected static setInternalFieldValue(
    field: KristaTypeField<KristaFieldAttributes, KristaValue>,
    value: KristaValue,
    recomputeParentValue = true
  ) {
    field.setInternalValue(value, recomputeParentValue);
  }

  protected static createFieldValue(
    field: KristaTypeField<KristaFieldAttributes, KristaValue>,
    rawValue: any
  ): KristaValue {
    return field.createKristaValue(rawValue);
  }
}

// function instanceOfICompositeField(obj: any): obj is ICompositeField {
//   return "recomputeValue" in obj;
// }
