import { SelectionModel } from "@angular/cdk/collections";
import { AfterViewInit, ChangeDetectorRef, ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from "@angular/core";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { fieldTypeToSvg } from "../../constants/fieldTypeToSvg";
import { TableActionCell } from "../TableActionCell";
import { TableHeaderCell } from "../TableHeaderCell";
import { TableInput } from "../TableInput";
import { TableRow } from "../TableRow";
import { TableValueCell } from "../TableValueCell";
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: "app-new-table",
  templateUrl: "./new-table.component.html",
  styleUrl: "./new-table.component.scss",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewTableComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() tableInput!: TableInput<any, any, any>;
  displayedColumns: string[] = [];
  selectedCellData: string = "";
  tableHeaders: TableHeaderCell[] = [];
  hasSelection: boolean = false;
  selection = new SelectionModel<TableRow<any>>(true, []);
  selectedCell: TableValueCell | null = null;
  activeSelection: Set<string> = new Set();
  _hasPrevPage = true;
  _hasNextPage = true;
  pageIndex : number = 1;
  pageSize : number  = 15;
  showTable : boolean = false;
  isEmptyTable : boolean = false;
  protected readonly TableValueCell = TableValueCell;
  protected readonly TableActionCell = TableActionCell;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private cdr: ChangeDetectorRef, public dialog: MatDialog) {}

  ngOnInit() {
    if(this.tableInput.selectedRowKey && this.tableInput.selectedRowKey.size){
      this.addActiveSelectionFromParent(this.tableInput.selectedRowKey);
    }
    this.pageSize = this.tableInput.tableConfig.pageSize;

    // Sync pageIndex with currentPage from config if provided
    if (this.tableInput.tableConfig.currentPage !== undefined) {
      this.pageIndex = this.tableInput.tableConfig.currentPage;
    }

    this.tableInput.dataSource.getTableRowObservable().subscribe((data) => {
      this.isEmptyTable = !data.length;

      // Sync pageIndex with currentPage from config on data updates
      if (this.tableInput.tableConfig.currentPage !== undefined) {
        this.pageIndex = this.tableInput.tableConfig.currentPage;
      }

      this.selectRowsByKeys(this.tableInput.dataSource.dataRows, this.activeSelection);
    });
    this.tableInput.dataSource.getNoDataAlertObservable().subscribe((showNoDataAlert)=>{
      this.selectRowsByKeys(this.tableInput.dataSource.dataRows, this.activeSelection);
      if(showNoDataAlert){
        this.showNoDataAlert();
        this.pageIndex--;
        this.isEmptyTable = true;
      }
    })
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["tableInput"] || changes["selectedValues"]) {
      this.processTableData();
      this.resetPaginator();
      this.selectRowsByKeys(this.tableInput.dataSource.dataRows, this.activeSelection);
    }
  }

  addActiveSelectionFromParent(selections: Set<string>) {
    for (let key of selections) {
      this.activeSelection.add(key);
    }
  }

  ngAfterViewInit() {
    this.tableInput.dataSource.sort = this.sort;

    this.sort.sortChange.subscribe((sort) => {
      this.tableInput.dataSource.sortData(sort);
    });
  }

  showNoDataAlert(): void {
    // TODO: Implement alert dialog for omni-angular
    console.warn('No data available for the selected page');
    // Simple browser alert as fallback
    alert('No data available');
  }

  selectRowsByKeys(dataRows: TableRow<any>[], selectionKeys: Set<String>) {
    // Iterate a SNAPSHOT, never the live set: selectionKeys is this.activeSelection,
    // and onRowSelect (selection == "SINGLE") clears + re-adds the same key into it.
    // Per JS Set semantics, a value removed and re-added during for..of is visited
    // AGAIN by the active iterator, so iterating the live set loops forever and
    // hard-freezes the UI (KR-21136: entity cell selected in a table + submit).
    for (const key of Array.from(selectionKeys)) {
      let selectedRow = dataRows.find((item: any) => {
        return item._uniqueKey === key;
      });
      if (selectedRow) {
        this.onRowSelect(selectedRow, { checked: true }); // Call only if a row is found
      } else {
        console.warn(`No row found for primary key: ${key}`);
      }
    }
    if(!dataRows.length || (dataRows.length < this.pageSize)) {
      this._hasNextPage = false;
    }else{
      this._hasNextPage = !(dataRows.length < this.pageSize);
    }
    this.showTable = true;
    this._hasPrevPage = this.pageIndex > 1;
    this.cdr.detectChanges();
  }

  processTableData() {
    this.tableHeaders = this.tableInput.dataSource.headersRows[0].cells;
    this.displayedColumns = this.tableHeaders.map((cell) => cell.title);

    // Only show selection column if not readonly and selection is enabled
    this.hasSelection = this.tableInput.tableConfig.selection !== "NONE" && !this.tableInput.tableConfig.readonly;
    if (this.hasSelection) {
      this.displayedColumns.unshift("select");
    }
  }

  onCellClick(cell: TableValueCell) {
    this.selectedCell = cell; // Store the clicked cell
    this.selectedCellData = cell.getDisplay();
  }

  getColumnIcon(columnType: string): string {
    if (columnType) {
      // Extract short field type name from full type string
      // e.g., "com.krista.fields.Text" -> "Text"
      const shortType = this.extractShortFieldType(columnType);
      const svgFileName = fieldTypeToSvg[shortType] || fieldTypeToSvg["default"];
      // Use absolute path starting with / so server can replace /assets/ with chatbot/ui/assets/
      // This matches the pattern in index.html for config.js and authenticator.js
      return `/assets/icons/${svgFileName}`;
    }
    return `/assets/icons/${fieldTypeToSvg["default"]}`;
  }

  /**
   * Extract short field type name from full type string
   * e.g., "com.krista.fields.Text" -> "Text"
   */
  extractShortFieldType(fullType: string): string {
    if (!fullType) return 'Text';


    // If it's already a short type (no dots), return as-is
    if (!fullType.includes('.')) {
      return fullType;
    }

    // Extract the last part after the last dot
    const parts = fullType.split('.');
    const shortType = parts[parts.length - 1];
    return shortType;
  }

  isAllSelected(): boolean {
    return this.tableInput.dataSource.dataRows.every((dataRow) => {
      let index = this.selection.selected.findIndex((item) => item.uniqueKey === dataRow.uniqueKey);
      return index != -1;
    });
  }

  checkboxLabel(): string {
    return this.isAllSelected() ? "Deselect all" : "Select all";
  }

  onRowSelect(row: any, event?: any): void {
    if (this.tableInput.tableConfig.selection == "SINGLE") {
      this.selection.clear();
      this.activeSelection.clear();
    }
    if (event.checked) {
      this.selection.select(row);
      if (row.uniqueKey) {
        this.activeSelection.add(row.uniqueKey);
      }
    } else {
      this.selection.deselect(row);
      if (row.uniqueKey) {
        this.activeSelection.delete(row.uniqueKey);
      }
    }
    this.emitSelectedItems();
  }

  emitSelectedItems() {
    // this.removeDuplicateSelection();
    if (this.tableInput?.tableConfig?.onSelection) {
      this.tableInput.tableConfig.onSelection.emit(new Set(this.activeSelection));
    }
  }

  removeDuplicateSelection() {
    const uniqueSelection = this.selection.selected.filter(
      (row, index, self) => index === self.findIndex((r) => r.uniqueKey === row.uniqueKey),
    );
    this.selection.clear();
    this.selection.select(...uniqueSelection);
  }

  toggleAllRows(): void {
    let isAllSelected = this.isAllSelected();
    // !isAllSelected &&  this.selection.select(...this.tableInput.dataSource.dataRows);
    this.tableInput.dataSource.dataRows.forEach((row) => {
      if (!isAllSelected) {
        this.selection.select(row);
        if (row.uniqueKey) {
          this.activeSelection.add(row.uniqueKey);
        }
      } else {
        this.selection.deselect(row);
        if (row.uniqueKey) {
          this.activeSelection.delete(row.uniqueKey);
        }
      }
    });
    this.emitSelectedItems();
  }

  removeRows() {
    if (!this.selection.selected.length) {
      return;
    }
    this.tableInput.dataSource.removeRows(this.selection.selected);
    if (this.tableInput.tableConfig.onRemoveSelection) {
      this.tableInput.tableConfig.onRemoveSelection.emit(this.selection.selected);
    }
    this.selection.clear();
    this.activeSelection.clear();
  }

  isTypeOf(object: any, Type: any): boolean {
    return object && object instanceof Type;
  }

  getColumn(index: number): any {
    return this.tableHeaders[index].field;
  }

  comparePage = (val1: number, val2: number): boolean => {
    return val1 == val2;
  }

  onPageChange($event: any) {
    $event.pageIndex =this.pageIndex;
    $event.pageSize = this.pageSize
    this.selectedCellData = "";
    this.showTable = false;
    if (this.tableInput.tableConfig.onPageChange) {
      this.tableInput.tableConfig.onPageChange.emit($event);
    }
    this._hasPrevPage = false;
    this._hasNextPage = false;
  }

  setPageSize(pageSize: string){
    this.resetPaginator();
    this.pageSize = Number.parseInt(pageSize, 10); // Convert string to number
    const event = {
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
    };
    this.onPageChange(event);
  }

  prevPage($event: any) {
    this.pageIndex--;
    this.onPageChange($event);
  }

  nextPage($event: any){
    this.pageIndex++;
    this.onPageChange($event);
  }

  private resetPaginator() {
    this.pageIndex = 1;
    this._hasPrevPage = false;
    this._hasNextPage = false;
    this.selectedCellData = "";
  }

  isSortable(column: TableHeaderCell){
    const nonSortableColumns = ['List', 'MultiField','Composite','Calculation','Checkboxes','DateRange','DateTimeRange','PickList','Entity','Location','Identifier','Selection','Steam','Stream']
    return !nonSortableColumns.includes(column.type);
  }

  getFieldData(index: number, cell: any) {
    if (!cell) return null;
    return  this.tableInput.dataSource.getCustomCellMeta(this.getColumn(index), cell.getRawValue());
  }

  /**
   * Convert cell data to FormField format for field components
   * @param cell - The table cell
   * @param column - The column header cell containing field definition
   * @returns FormField object
   */
  getCellAsFormField(cell: TableValueCell, column: any): any {
    const rawValue = cell.getRawValue();
    const fieldType = column.type;

    // Get field definition from column
    const fieldDef = column.field;
    const fieldJson = fieldDef?.getJson ? fieldDef.getJson() : fieldDef;

    // Extract attributeValues safely
    let attributeValues: any = {};
    if (fieldJson && typeof fieldJson === 'object' && 'attributeValues' in fieldJson) {
      attributeValues = (fieldJson as any).attributeValues || {};
    }

    // Try to get options from field attributes (Map) if available
    // This is needed for PickMany/Checkboxes fields
    if (fieldDef?.getAttributes && typeof fieldDef.getAttributes === 'function') {
      const attributes = fieldDef.getAttributes();
      if (attributes && typeof attributes.get === 'function') {
        const options = attributes.get('options');
        if (options) {
          attributeValues['options'] = options;
        }
      }
    }

    // Also check if options are in the JSON directly
    if (!attributeValues['options'] && fieldJson?.options) {
      attributeValues['options'] = fieldJson.options;
    }

    // Check for options in sourceJson
    if (!attributeValues['options'] && fieldDef?.sourceJson?.options) {
      attributeValues['options'] = fieldDef.sourceJson.options;
    }

    return {
      name: column.title || '',
      displayName: column.title || '',
      fieldType: fieldType,
      value: rawValue,
      required: false,
      readOnly: true,
      attributeValues: attributeValues
    };
  }

  /**
   * Get BasicFieldConfig for read-only table cells
   */
  getReadOnlyFieldConfig(): any {
    return {
      hasError: false,
      errorMessage: '',
      readOnly: true
    };
  }

  /**
   * Get RichTextFieldConfig for rich text fields in table cells
   * Includes compact mode for table display
   */
  getRichTextFieldConfigForTable(): any {
    const config = {
      displayValue: '',
      hasError: false,
      errorMessage: '',
      readOnly: true,
      maxLineCount: 2,
      compact: true, // Enable compact mode for table cells
      showLabel: false // Hide label in table cells
    };
    console.log('🔵 [TABLE] getRichTextFieldConfigForTable returning:', config);
    return config;
  }

  /**
   * Get display value for File/Camera fields
   * @param cell - The table cell containing file data
   * @returns Formatted string of file names
   */
  getFileDisplayValue(cell: TableValueCell): string {
    const rawValue = cell.getRawValue() as any;

    if (!rawValue) {
      return '';
    }

    // Handle array of files
    if (Array.isArray(rawValue)) {
      const fileNames = rawValue.map((file: any) => {
        if (typeof file === 'string') {
          return file;
        }
        return file?.fileName || file?.name || 'File';
      });
      return fileNames.join(', ');
    }

    // Handle single file object
    if (typeof rawValue === 'object') {
      return (rawValue as any)?.fileName || (rawValue as any)?.name || 'File';
    }

    // Handle string value
    if (typeof rawValue === 'string') {
      return rawValue;
    }

    return '';
  }

  /**
   * TrackBy function for table columns to prevent unnecessary DOM recreation
   */
  trackByColumn(index: number, column: TableHeaderCell): string {
    return column.title;
  }
}
