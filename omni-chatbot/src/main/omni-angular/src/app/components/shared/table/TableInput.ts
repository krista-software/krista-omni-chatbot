import {TableConfig} from "./TableConfig";
import {TableDataSource} from "./TableDataSource";
import {TableRow} from "./TableRow";
import {TableValueCell} from "./TableValueCell";
import {ValueCell} from "./ValueCell";

export class TableInput<T,V ,VC extends ValueCell> {
  tableConfig!: TableConfig;
  dataSource!: TableDataSource<T, V, VC>;
  selectedRowKey? : Set<string> = new Set()
}

