import { KSDKFormField } from "../../../../messaging/form/KSDKFormField";

export class EntitySearchDto {
  constructor(
    public readonly sourceField: KSDKFormField,
    public readonly filterFieldName: string,
    public readonly value: string,
    public readonly page: number,
    public readonly count: number
  ) {}

  toJSON(): any {
    const json: any = {};
    json["sourceField"] = this.sourceField.toJSON();
    json["filterFieldName"] = this.filterFieldName;
    json["value"] = this.value;
    json["page"] = this.page;
    json["count"] = this.count;
    return json;
  }
}
