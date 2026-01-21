import {
  createMap,
  fieldType,
} from "../../fields-handler/state-managers/classes/utils";
import { FieldTypes } from "../../fields-handler/state-managers/FieldTypes";
import { FieldOptionsJson } from "../../fields-handler/state-managers/types";

export class TCOptionType {
  constructor(readonly fieldType: string, readonly value: any) {}

  static create(json: FieldOptionsJson) {
    if (!json) {
      return undefined;
    }
    return new TCOptionType(json["fieldType"], json["value"]);
  }
}

export class KSDKFormField {
  private _subfields: KSDKFormField[] = [];

  required: boolean = false;
  readOnly: boolean = false;
  // TODO validate new-ksdk attributes and options
  constructor(
    readonly name: string,
    readonly displayName: string = "",
    readonly value: any,
    readonly fieldType: FieldTypes,
    readonly attributes: Map<string, any>,
    readonly options: Map<string, TCOptionType>,
    readonly source: any // TODO review
  ) {
    this.displayName = this.displayName || this.name;
    this.required = !!this.options.get("required")?.value;
    this.readOnly = !!this.options.get("readOnly")?.value;
    if (this.attributes.get("subfields")) {
      this._subfields = KSDKFormField.fromJSONArray(
        this.attributes.get("subfields")
      );
    } else if (this.attributes.get("entityDefinition")) {
      this._subfields = KSDKFormField.fromJSONArray(
        Object.values(this.attributes.get("entityDefinition")["fields"])
      ); // Object.values works for array and object
    } else if (this.attributes.get("fields")) {
      this._subfields = KSDKFormField.fromJSONArray(
        this.attributes.get("fields")
      );
    }
  }

  getSubFields(): KSDKFormField[] {
    return this._subfields;
  }

  isComposite(): boolean {
    switch (this.fieldType) {
      case FieldTypes.COMPOSITE_FIELD:
      case FieldTypes.MULTI_FIELD:
      case FieldTypes.ENTITY_FIELD:
        return true;

      default:
        return false;
    }
  }

  isTabular(): boolean {
    switch (this.fieldType) {
      case FieldTypes.TABLE_FIELD:
      case FieldTypes.LIST_FIELD:
        return true;

      default:
        return false;
    }
  }

  toJSON(): any {
    return this.source;
  }

  static fromJSON(json: any): KSDKFormField | undefined {
    if (!json) {
      return undefined;
    }
    const optionsJson: { [key: string]: FieldOptionsJson } = json["options"];
    const options: { [key: string]: TCOptionType } = {};
    if (optionsJson) {
      Object.keys(optionsJson).forEach((option: string) => {
        const _o = TCOptionType.create(optionsJson[option]);
        if (_o) {
          options[option] = _o;
        }
      });
    }

    const fieldTypeJson = json["fieldType"];
    let logicalName;
    if (typeof json["fieldType"] == "object") {
      logicalName = fieldTypeJson["logicalName"];
    } else {
      logicalName = fieldTypeJson;
    }
    return new KSDKFormField(
      json["name"] || "",
      json["displayLabel"] || "",
      json["value"],
      fieldType(logicalName),
      createMap(json["attributeValues"]),
      createMap(options),
      json
    );
  }

  static fromJSONArray(jsonArray: any[]): KSDKFormField[] {
    if (!jsonArray) {
      return [];
    }

    const formPageFields = new Array<KSDKFormField>();
    jsonArray.forEach((fieldJson) => {
      const formPageField = this.fromJSON(fieldJson);
      if (formPageField) {
        formPageFields.push(formPageField);
      }
    });
    return formPageFields;
  }
}
