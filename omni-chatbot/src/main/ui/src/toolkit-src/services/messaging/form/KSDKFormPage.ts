import { KSDKFormField } from "./KSDKFormField";
import { FieldsHandlerService } from "../../../services/fields-handler/FieldsHandlerService";
import { KristaFieldAttributes } from "../../../services/fields-handler/state-managers/field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../../services/fields-handler/state-managers/field-values/KristaValue";
import { KristaTypeField } from "../../../services/fields-handler/state-managers/fields/KristaTypeField";
import { consoleLog } from "../../../common/utils";

export class KSDKFormPage {
  constructor(
    readonly title: string,
    readonly fields: Array<KSDKFormField>,
    readonly fieldStates: KristaTypeField<KristaFieldAttributes, KristaValue>[]
  ) {}

  get isEmpty(): boolean {
    return !(this.fields && this.fields.length > 0);
  }

  toJSON(): any {
    const json: any = {};
    json["title"] = this.title;
    const pageJson: any[] = [];
    for (const page of this.fields) {
      pageJson.push(page.toJSON());
    }
    json["fields"] = pageJson;
    return json;
  }

  static fromJSON(json: any): KSDKFormPage | null {
    if (json == null) {
      return null;
    }
    const fieldsJson = json["fields"];
    const pageFields: KSDKFormField[] = [];
    const fieldStates: KristaTypeField<KristaFieldAttributes, KristaValue>[] =
      [];
    if (fieldsJson && Array.isArray(fieldsJson)) {
      fieldsJson.forEach((value) => {
        const pageField = KSDKFormField.fromJSON(value);
        if (pageField) {
          pageFields.push(pageField);
          const fieldState =
            FieldsHandlerService.getFieldStateManager(pageField);
          consoleLog("22 field created - set value start", pageField.value);
          fieldState.setValue(pageField.value, false, false);
          consoleLog("22 field created - set value done", {
            val: fieldState.getKristaValue().getValue(),
            formatted: fieldState.formattedValue,
          });
          if (fieldState) {
            fieldStates.push(fieldState);
          }
        }
      });
    }
    return new KSDKFormPage(json["title"], pageFields, fieldStates);
  }

  static fromJSONArray(jsonArray: Array<JSON>): KSDKFormPage[] {
    if (jsonArray == null) {
      return [];
    }

    const formPages: KSDKFormPage[] = [];
    for (let json of jsonArray) {
      const formPage = this.fromJSON(json);
      if (formPage) {
        formPages.push(formPage);
      }
    }
    return formPages;
  }
}
