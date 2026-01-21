import { KSDKFormPage } from "./KSDKFormPage";
import { KSDKFormResponse } from "./KSDKFormResponse";
import { recursivelySetFieldRedOnlyStatus } from "../../fields-handler/utils/fields";

export class KSDKForm {
  private _readOnly: boolean = false;
  constructor(readonly pages: Array<KSDKFormPage>) {}

  get readOnly(): boolean {
    return this._readOnly;
  }

  set readOnly(val: boolean) {
    this._readOnly = val;
    this.pages.forEach((page) => {
      page.fieldStates.forEach((field) => {
        recursivelySetFieldRedOnlyStatus(field, val);
      });
    });
  }

  prepareFormResponse(): KSDKFormResponse {
    const fieldValues = new Map<string, any>();
    this.pages.forEach((page) => {
      page.fieldStates.forEach((field) => {
        fieldValues.set(field.fieldId, field.toResponse());
      });
    });
    return new KSDKFormResponse(fieldValues);
  }

  toJSON(): any {
    const json: any = {};
    const pagesJson: any[] = [];
    for (const page of this.pages) {
      pagesJson.push(page.toJSON());
    }
    json["pages"] = pagesJson;
    return json;
  }

  static isValidForm(form: KSDKForm | undefined): boolean {
    if (!form) {
      return false;
    }
    const pages = form.pages;
    if (!pages || pages.length === 0) {
      return false;
    }
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      if (page.isEmpty) {
        return false;
      }
    }

    return true;
  }

  static fromJSON(json: any): KSDKForm | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKForm(KSDKFormPage.fromJSONArray(json["pages"]));
  }
}
