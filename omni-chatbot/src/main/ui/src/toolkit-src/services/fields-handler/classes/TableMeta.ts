import { KSDKFormField } from "./../../messaging/form/KSDKFormField";
import { EntitySelectorMeta } from "./entity/EntitySelectorMeta";

export class TableMeta {
  public readonly entitySelectorMeta: EntitySelectorMeta | undefined;

  constructor(
    readonly columns: KSDKFormField[],
    readonly headers: (KSDKFormField | undefined)[][],
    readonly footers: (KSDKFormField | undefined)[][],
    readonly entity?: KSDKFormField
  ) {
    if (this.entity) {
      this.entitySelectorMeta = new EntitySelectorMeta(this.entity.attributes);
    }
  }

  get entityFieldId(): string {
    return this.entity?.name || "";
  }

  static createHeaderFooter(
    json: any[][],
    readOnly = false
  ): (KSDKFormField | undefined)[][] {
    if (!json || !Array.isArray(json) || json.length === 0) {
      return [];
    }
    const header_footer: (KSDKFormField | undefined)[][] = [];
    json.forEach((jsonRow) => {
      const formPageFields: (KSDKFormField | undefined)[] = [];
      jsonRow.forEach((fieldJson) => {
        if (fieldJson) {
          const field = KSDKFormField.fromJSON(fieldJson);
          if (field) {
            field.readOnly = readOnly;
          }
          formPageFields.push(field);
        } else {
          formPageFields.push(undefined);
        }
      });
      header_footer.push(formPageFields);
    });
    return header_footer;
  }

  static fromJSON(json: any, readOnly = false): TableMeta {
    const columnsFields: KSDKFormField[] = [];
    const columnJsonArray: any[] = json["columns"];
    columnJsonArray.forEach((fieldJson) => {
      const field = KSDKFormField.fromJSON(fieldJson.field);
      if (field) {
        field.readOnly =
          readOnly || isReadOnlyAccess(fieldJson["access"] || "");
        columnsFields.push(field);
      }
    });
    const headerRows: any[] = [...json["headerRows"]];
    // we need the actual columns to flatten the composite fields, if any
    headerRows[headerRows.length - 1] = columnJsonArray.map((col) => col.field);
    const header = this.createHeaderFooter(headerRows, readOnly);
    const footer = this.createHeaderFooter(json["footerRows"], readOnly);
    const tableEntityField = KSDKFormField.fromJSON(json["entity"]);
    return new TableMeta(columnsFields, header, footer, tableEntityField);
  }
}

function isReadOnlyAccess(access: string) {
  return access.toLowerCase() === "read";
}
