import { HeaderRow } from "../../fields/table/HeaderRow";
import { ValueJson } from "../../types";
import { BaseTableValue } from "./BaseTableValue";
import { TableRowValue } from "./TableRowValue";

export class TableValue extends BaseTableValue {
  private headers: HeaderRow[] = [];
  private footers: HeaderRow[] | undefined;
  private deletedRows: TableRowValue[] = [];

  constructor(readonly rawValue?: any) {
    super(rawValue);
  }

  setHeaders(headers: HeaderRow[]) {
    this.headers = headers;
  }

  setFooters(footers: HeaderRow[] | undefined) {
    this.footers = footers;
  }

  addDeletedRow(row: TableRowValue) {
    this.deletedRows.push(row);
  }

  toResponse(): ValueJson | undefined {
    if (this.rows.length === 0 && this.deletedRows.length === 0) {
      return undefined;
    }
    const response: ValueJson = {};
    const rows: ValueJson[] = [];
    (this.rows || []).forEach((row) => {
      const rowResponse = row.toResponse();
      if (rowResponse) {
        rows.push(rowResponse);
      }
    });
    const deletedRows: ValueJson[] = [];
    (this.deletedRows || []).forEach((row) => {
      const rowResponse = row.toResponse();
      if (rowResponse) {
        deletedRows.push(rowResponse);
      }
    });
    response["rows"] = rows;
    response["deletedRows"] = deletedRows;
    response["headers"] = this.headers.map((header) => header.toResponse());
    response["footers"] = this.footers?.map((footer) => footer.toResponse());
    return response;
  }
}
