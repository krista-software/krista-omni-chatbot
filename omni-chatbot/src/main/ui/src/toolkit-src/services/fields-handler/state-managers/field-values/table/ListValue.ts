import { BaseTableValue } from "./BaseTableValue";

export class ListValue extends BaseTableValue {
  constructor(readonly rawValue?: any) {
    super(rawValue);
  }

  toResponse(): any {
    if (!this.rows || this.rows.length === 0) {
      return undefined;
    }
    return this.rows.map((row) => {
      const response = row.toResponse();
      if (response) {
        return Object.values(response)[0];
      }
      return undefined;
    });
  }
}
