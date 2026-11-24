import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe for formatting list row values based on field type.
 * Handles various field types including Date, Boolean, Rating, Entity, etc.
 *
 * Usage: {{ rowData | listRowFormat:fieldType }}
 * Example: {{ dateValue | listRowFormat:'com.krista.fields.Date' }} => "12/1/2023"
 */
@Pipe({
  name: 'listRowFormat',
  standalone: false,
  pure: true
})
export class ListRowFormatPipe implements PipeTransform {
  transform(rowData: any, fieldType?: string): string {
    if (rowData === null || rowData === undefined) {
      return '';
    }

    // Handle different field types
    if (fieldType) {
      switch (fieldType) {
        case 'com.krista.fields.Date':
          return rowData ? new Date(rowData).toLocaleDateString() : '';

        case 'com.krista.fields.Switch':
        case 'com.krista.fields.Boolean':
          return rowData ? 'Yes' : 'No';

        case 'com.krista.fields.Rating':
          return '★'.repeat(rowData || 0);

        case 'com.krista.fields.Entity':
        case 'com.krista.fields.EntityReference':
          return this.formatEntityValue(rowData);

        case 'com.krista.fields.MultiField':
        case 'com.krista.fields.Composite':
          return this.formatCompositeValue(rowData);

        default:
          break;
      }
    }

    // Default formatting for objects
    if (typeof rowData === 'object') {
      return this.formatObjectValue(rowData);
    }

    // Default: convert to string
    return String(rowData);
  }

  /**
   * Format entity-like values
   */
  private formatEntityValue(rowData: any): string {
    if (typeof rowData === 'object' && rowData !== null) {
      // Check for entityName first
      if (rowData.entityName) {
        return rowData.entityName;
      }
      // Check for textSummary
      if (rowData.textSummary) {
        return rowData.textSummary;
      }
      // Try to extract from fields object
      if (rowData.fields && typeof rowData.fields === 'object') {
        const fieldValues = Object.values(rowData.fields)
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
        if (fieldValues.length > 0) {
          return fieldValues.join(', ');
        }
      }
      // Try to extract from meta
      if (rowData.meta && rowData.meta.primaryKey) {
        return `Entity: ${rowData.meta.primaryKey}`;
      }
    }
    return String(rowData);
  }

  /**
   * Format composite/multi-field values
   */
  private formatCompositeValue(rowData: any): string {
    if (typeof rowData === 'object' && rowData !== null) {
      const values = Object.values(rowData).filter(v => v !== null && v !== undefined);
      return values.join(', ');
    }
    return String(rowData);
  }

  /**
   * Format generic object values
   */
  private formatObjectValue(rowData: any): string {
    // Check if it's an entity-like object
    if (rowData.entityName) {
      return rowData.entityName;
    }
    if (rowData.textSummary) {
      return rowData.textSummary;
    }
    if (rowData.fields && typeof rowData.fields === 'object') {
      const fieldValues = Object.values(rowData.fields)
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
      if (fieldValues.length > 0) {
        return fieldValues.join(', ');
      }
    }

    // Handle arrays
    if (Array.isArray(rowData)) {
      return rowData.join(', ');
    }

    // Try to get meaningful string representation
    const keys = Object.keys(rowData);
    if (keys.length > 0) {
      const values = keys
        .map(k => rowData[k])
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
      if (values.length > 0) {
        return values.join(', ');
      }
    }

    return JSON.stringify(rowData);
  }
}

