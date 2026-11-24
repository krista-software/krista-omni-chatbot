import { TableDataSource, TableDataModel } from '../../../shared/table/TableDataSource';
import { TableRow } from '../../../shared/table/TableRow';
import { TableHeaderCell } from '../../../shared/table/TableHeaderCell';
import { TableValueCell } from '../../../shared/table/TableValueCell';
import { EntitySearchResult } from '../../../../models/entity.model';

/**
 * Table Data Source for Entity Search Results
 * Converts entity search results into table format for NewTable component
 */
export class EntitySearchTableDataSource extends TableDataSource<any[], EntitySearchResult[], TableValueCell> {
  private columns: any[];

  constructor(
    columns: any[],
    entities: EntitySearchResult[],
    onActionCellClick: (headerCell: TableHeaderCell, rawValue: any) => void
  ) {
    super(columns, entities, onActionCellClick);
    this.columns = columns;
  }

  /**
   * Initialize table structure with headers and data rows
   */
  protected initTable(columns: any[], entities: EntitySearchResult[]): TableDataModel<TableValueCell> {
    const headerRows = this.prepareHeaderRows(columns);
    const dataRows = this.prepareDataRows(entities, headerRows[0]);
    const footerRows: TableRow<TableHeaderCell>[] = [];

    return {
      headerRows,
      footerRows,
      dataRows
    };
  }

  /**
   * Prepare header rows from column definitions
   */
  private prepareHeaderRows(columns: any[]): TableRow<TableHeaderCell>[] {
    const headerCells: TableHeaderCell[] = columns.map(column => {
      // Get field name and type from IField
      const fieldJson = (column as any).getJson ? (column as any).getJson() : column;
      const fieldName = (column as any).name || fieldJson.name || 'Unknown';

      // Try multiple ways to get field type
      const fieldType = column.fieldType || fieldJson.fieldType || fieldJson.type || 'com.krista.fields.Text';

      const headerCell = new TableHeaderCell();
      headerCell.title = fieldName;
      headerCell.type = fieldType;
      headerCell.field = column;

      return headerCell;
    });

    return [new TableRow('header', headerCells)];
  }

  /**
   * Prepare data rows from entity search results
   */
  protected prepareDataRows(entities: EntitySearchResult[], headerRow?: TableRow<TableHeaderCell>): TableRow<TableValueCell>[] {
    if (!entities || entities.length === 0) {
      return [];
    }

    // Get column definitions from header row parameter or from this.headersRows
    const columns = headerRow?.cells || this.headersRows[0]?.cells || [];

    return entities.map((entity, rowIndex) => {
      const primaryKey = entity.value?.meta?.primaryKey || `row-${rowIndex}`;

      const cells: TableValueCell[] = columns.map((headerCell: TableHeaderCell) => {
        const fieldName = headerCell.title;
        const rawValue = entity.value?.fields?.[fieldName];
        const fieldType = headerCell.type;

        // Format the display value based on field type
        const displayValue = this.formatValueForDisplay(rawValue, fieldType);

        // TableValueCell constructor: (rawValue: KristaValue, value: string)
        return new TableValueCell(rawValue, displayValue);
      });

      return new TableRow(primaryKey, cells);
    });
  }

  /**
   * Format value for display based on field type
   */
  private formatValueForDisplay(value: any, fieldType: string): string {
    if (value === null || value === undefined) return '';

    // Handle different field types
    switch (fieldType) {
      case 'com.krista.fields.Switch':
        return this.formatBooleanValue(value);
      
      case 'com.krista.fields.Rating':
        return this.formatRatingValue(value);
      
      case 'com.krista.fields.Date':
        return this.formatDateValue(value);
      
      case 'com.krista.fields.DateTime':
        return this.formatDateTimeValue(value);
      
      case 'com.krista.fields.DateRange':
      case 'com.krista.fields.DateTimeRange':
        return this.formatRangeValue(value, fieldType);
      
      case 'com.krista.fields.MultiField':
      case 'com.krista.fields.Composite':
      case 'com.krista.fields.EntityReference':
        return this.formatMultiFieldValue(value);
      
      case 'com.krista.fields.Phone':
        return this.formatPhoneValue(value);
      
      case 'com.krista.fields.Currency':
        return this.formatCurrencyValue(value);
      
      case 'com.krista.fields.Percentage':
        return this.formatPercentageValue(value);
      
      case 'com.krista.fields.PickOne':
      case 'com.krista.fields.PickMany':
        return this.formatPickValue(value);
      
      default:
        // Default formatting
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }
  }

  // Format helper methods
  private formatBooleanValue(value: any): string {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === 'yes') return 'Yes';
      if (lower === 'false' || lower === 'no') return 'No';
    }
    return String(value);
  }

  private formatRatingValue(value: any): string {
    const rating = typeof value === 'number' ? value : parseInt(value);
    if (isNaN(rating)) return String(value);
    const maxRating = 5;
    const filledStars = '★'.repeat(Math.min(rating, maxRating));
    const emptyStars = '☆'.repeat(Math.max(0, maxRating - rating));
    return `${filledStars}${emptyStars} (${rating})`;
  }

  private formatDateValue(value: any): string {
    if (!value) return '';
    try {
      const timestamp = typeof value === 'number' ? value : parseInt(value);
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return String(value);
    }
  }

  private formatDateTimeValue(value: any): string {
    if (!value) return '';
    try {
      const timestamp = typeof value === 'number' ? value : parseInt(value);
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return String(value);
    }
  }

  private formatRangeValue(value: any, fieldType: string): string {
    if (!value || typeof value !== 'object') return '';
    const start = value.start || value.startDate;
    const end = value.end || value.endDate;
    if (!start && !end) return '';
    
    const formatter = fieldType.includes('DateTime') 
      ? this.formatDateTimeValue.bind(this)
      : this.formatDateValue.bind(this);
    
    const startStr = start ? formatter(start) : '';
    const endStr = end ? formatter(end) : '';
    
    if (startStr && endStr) return `${startStr} - ${endStr}`;
    if (startStr) return `From ${startStr}`;
    if (endStr) return `Until ${endStr}`;
    return '';
  }

  private formatMultiFieldValue(value: any): string {
    if (!value || typeof value !== 'object') return '';
    const entries = Object.entries(value)
      .filter(([key, val]) => key !== 'primaryKey' && val !== null && val !== undefined)
      .map(([key, val]) => {
        const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `${key}: ${formattedVal}`;
      });
    return entries.join(', ');
  }

  private formatPhoneValue(value: any): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      const countryCode = value.countryCode || '';
      const nationalNumber = value.nationalNumber || '';
      if (countryCode && nationalNumber) return `+${countryCode} ${nationalNumber}`;
      return nationalNumber || countryCode || '';
    }
    return String(value);
  }

  private formatCurrencyValue(value: any): string {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return String(value);
    return `$${num.toFixed(2)}`;
  }

  private formatPercentageValue(value: any): string {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return String(value);
    return `${num}%`;
  }

  private formatPickValue(value: any): string {
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'object' ? v.label || v.value || String(v) : String(v)).join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return value.label || value.value || String(value);
    }
    return String(value);
  }

  /**
   * Update entities and refresh table
   */
  public updateEntities(entities: EntitySearchResult[]): void {
    const dataRows = this.prepareDataRows(entities, this.headersRows[0]);
    this.updateDataRows(dataRows);
  }
}

