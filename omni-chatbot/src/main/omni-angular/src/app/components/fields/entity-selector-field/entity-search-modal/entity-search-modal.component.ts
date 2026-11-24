import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormField } from '../../../../models/message.model';
import {
  EntitySelectorMeta,
  EntitySearchResult,
  EntitySearchFilter,
  EntitySearchDto
} from '../../../../models/entity.model';
import { EntitySearchService } from '../../../../services/entity-search.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TableInput } from '../../../shared/table/TableInput';
import { TableConfig } from '../../../shared/table/TableConfig';
import { TableValueCell } from '../../../shared/table/TableValueCell';
import { EntitySearchTableDataSource } from './entity-search-table-data-source';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error' | 'authentication';

/**
 * Entity Search Modal Component
 *
 * Modal dialog for searching and selecting entities.
 * Features:
 * - Search bar with filter dropdown
 * - Search results list with entity fields
 * - Pagination
 * - Single and multi-select modes
 * - Authentication handling
 */
@Component({
  selector: 'app-entity-search-modal',
  templateUrl: './entity-search-modal.component.html',
  styleUrls: ['./entity-search-modal.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitySearchModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() field!: FormField;
  @Input() entitySelectorMeta!: EntitySelectorMeta;
  @Input() currentValue?: any;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<EntitySearchResult[]>();

  // Search state
  searchStatus: SearchStatus = 'idle';
  searchResults: EntitySearchResult[] = [];
  searchValue: string = '';
  selectedFilter?: EntitySearchFilter;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [5, 10, 15, 20, 25];
  hasNextPage: boolean = false;
  hasPrevPage: boolean = false;

  // Selection
  selectionMap = new Map<string, EntitySearchResult>();

  // Dropdown states
  isFilterDropdownOpen: boolean = false;
  isPageSizeDropdownOpen: boolean = false;

  // Authentication
  authDetails?: {
    invokerName: string;
    authUrl: string;
  };

  // Error
  errorMessage: string = '';

  // NewTable integration
  tableInput?: TableInput<any[], EntitySearchResult[], TableValueCell>;
  tableDataSource?: EntitySearchTableDataSource;

  constructor(
    private entitySearchService: EntitySearchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Set first filter as default
    if (this.entitySelectorMeta.availableFilters.length > 0) {
      this.selectedFilter = this.entitySelectorMeta.availableFilters[0];
    }

    // Initialize selection from current value
    this.initializeSelectionFromCurrentValue();

    // Perform default search if allowDefaultSearch is true (matching original implementation)
    if (this.entitySelectorMeta.allowDefaultSearch) {
      this.performSearch(true);
    }
  }

  /**
   * Initialize selection map from current field value
   */
  private initializeSelectionFromCurrentValue(): void {
    if (!this.currentValue) {
      return;
    }

    const isMultiSelect = this.entitySelectorMeta.isMultiSelect;
    const values = isMultiSelect
      ? (Array.isArray(this.currentValue) ? this.currentValue : [this.currentValue])
      : [this.currentValue];

    // Convert current values to EntitySearchResult format and add to selection map
    values.forEach(value => {
      if (value && value.meta && value.meta.primaryKey) {
        const entityResult: EntitySearchResult = {
          value: value,
          textSummary: this.generateTextSummary(value.fields),
          fields: []
        };
        this.selectionMap.set(value.meta.primaryKey, entityResult);
      }
    });
  }

  /**
   * Generate text summary from field values
   */
  private generateTextSummary(fields: any): string {
    if (!fields) return '';

    const values: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'primaryKey' || typeof value === 'object') continue;
      if (value !== null && value !== undefined && value !== '') {
        values.push(String(value));
      }
    }

    return values.slice(0, 3).join(' • ');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.entitySearchService.cancelSearch();
  }

  /**
   * Close dropdowns when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.isFilterDropdownOpen = false;
      this.isPageSizeDropdownOpen = false;
    }
  }

  /**
   * Check if multi-select mode
   */
  get isMultiSelect(): boolean {
    return this.entitySelectorMeta.isMultiSelect;
  }

  /**
   * Get available filters
   */
  get availableFilters(): EntitySearchFilter[] {
    return this.entitySelectorMeta.availableFilters;
  }

  /**
   * Compare function for filter dropdown
   */
  compareFilters(filter1: EntitySearchFilter | undefined, filter2: EntitySearchFilter | undefined): boolean {
    if (!filter1 || !filter2) {
      return filter1 === filter2;
    }
    return filter1.field.name === filter2.field.name;
  }

  /**
   * Toggle filter dropdown
   */
  toggleFilterDropdown(): void {
    this.isFilterDropdownOpen = !this.isFilterDropdownOpen;
    if (this.isFilterDropdownOpen) {
      this.isPageSizeDropdownOpen = false;
    }
  }

  /**
   * Select filter from dropdown
   */
  selectFilter(filter: EntitySearchFilter): void {
    this.selectedFilter = filter;
    this.searchValue = '';
    this.isFilterDropdownOpen = false;
  }

  /**
   * Toggle page size dropdown
   */
  togglePageSizeDropdown(): void {
    this.isPageSizeDropdownOpen = !this.isPageSizeDropdownOpen;
    if (this.isPageSizeDropdownOpen) {
      this.isFilterDropdownOpen = false;
    }
  }

  /**
   * Select page size from dropdown
   */
  selectPageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.isPageSizeDropdownOpen = false;
    this.performSearch(false);
  }

  /**
   * Handle filter change (legacy method, kept for compatibility)
   */
  onFilterChange(filter: EntitySearchFilter | undefined): void {
    // selectedFilter is already updated by ngModel
    if (filter) {
      this.searchValue = '';
    }
  }

  /**
   * Handle search value change
   */
  onSearchValueChange(value: string): void {
    this.searchValue = value;
  }

  /**
   * Handle search button click
   */
  onSearch(): void {
    this.resetPagination();
    this.performSearch(false);
  }

  /**
   * Clear search value and reset to idle state
   */
  clearSearch(): void {
    this.searchValue = '';
    this.searchResults = [];
    this.searchStatus = 'idle';
    this.resetPagination();
  }

  /**
   * Perform entity search
   */
  private performSearch(isDefaultSearch: boolean): void {
    this.searchStatus = 'loading';
    this.errorMessage = '';
    this.authDetails = undefined;

    const filterFieldName = isDefaultSearch ? '' : (this.selectedFilter?.field.name || '');
    const searchDto: EntitySearchDto = {
      sourceField: this.field,
      filterFieldName,
      value: this.searchValue,
      page: this.currentPage,
      count: this.pageSize
    };

    this.entitySearchService.searchEntities(searchDto)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        if (response.status === 'authentication' && response.authentication) {
          this.searchStatus = 'authentication';
          this.authDetails = response.authentication;
        } else if (response.status === 'error') {
          this.searchStatus = 'error';
          this.errorMessage = response.errorMessage || 'Failed to search entities';
        } else if (response.status === 'success' && response.data) {
          this.searchStatus = 'success';
          this.searchResults = response.data.results;

          // Determine hasNextPage based on result count (matching original implementation)
          // If we got fewer results than pageSize, there are no more pages
          // If we got exactly pageSize results, there might be more
          this.hasNextPage = !(this.searchResults.length < this.pageSize);
          this.hasPrevPage = this.currentPage > 1;

          // Initialize NewTable with search results
          if (this.searchResults.length > 0) {
            this.initializeNewTable();
          }
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.searchStatus = 'error';
        this.errorMessage = error.message || 'Failed to search entities';
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Reset pagination
   */
  private resetPagination(): void {
    this.currentPage = 1;
    this.hasNextPage = false;
    this.hasPrevPage = false;
    this.searchResults = [];
    // Don't clear selectionMap - keep pre-selected entities
  }

  /**
   * Handle next page
   */
  onNextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
      this.performSearch(false);
    }
  }

  /**
   * Handle previous page
   */
  onPrevPage(): void {
    if (this.hasPrevPage) {
      this.currentPage--;
      this.performSearch(false);
    }
  }

  /**
   * Handle page size change
   */
  onPageSizeChange(newPageSize: number): void {
    // pageSize is already updated by ngModel
    this.currentPage = 1; // Reset to first page when changing page size
    this.performSearch(false);
  }



  /**
   * Handle save button (multi-select)
   */
  onSave(): void {
    const selectedEntities = Array.from(this.selectionMap.values());
    this.save.emit(selectedEntities);
  }

  /**
   * Handle cancel button
   */
  onCancel(): void {
    this.close.emit();
  }

  /**
   * Handle authentication
   */
  onAuthenticate(): void {
    if (this.authDetails?.authUrl) {
      this.openAuthWindow(this.authDetails.authUrl);
    }
  }

  /**
   * Open authentication window
   */
  private openAuthWindow(authUrl: string): void {
    const width = window.screen.height * 0.6;
    const height = window.screen.height * 0.6;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(
      authUrl,
      'popup',
      `width=${width},height=${height},menubar=0,top=${top},left=${left}`
    );
  }

  /**
   * Get selection count
   */
  get selectionCount(): number {
    return this.selectionMap.size;
  }



  /**
   * Initialize NewTable component with search results
   */
  private initializeNewTable(): void {
    if (this.searchResults.length === 0) return;

    // Get field definitions from entity definition
    const entityDef = this.entitySelectorMeta.entityDefinition;
    if (!entityDef || !entityDef.fields) return;

    // Get fields from first result to determine which columns to show
    const firstResult = this.searchResults[0];
    const fields = firstResult.value.fields || {};

    // Get field definitions for columns (handle both array and object formats)
    const fieldsArray = Array.isArray(entityDef.fields)
      ? entityDef.fields
      : Object.values(entityDef.fields);

    // Helper function to get field definition by name
    const getFieldDef = (fieldName: string): any => {
      if (Array.isArray(entityDef.fields)) {
        return entityDef.fields.find((f: any) => f.name === fieldName);
      } else if (typeof entityDef.fields === 'object') {
        return entityDef.fields[fieldName] || null;
      }
      return null;
    };

    // Filter fields to show (exclude primaryKey and complex nested objects)
    const fieldsToShow = Object.keys(fields)
      .filter(fieldName => {
        const value = fields[fieldName];
        if (fieldName === 'primaryKey') return false;

        // Get field definition to check field type
        const fieldDef = getFieldDef(fieldName);
        const fieldType = fieldDef?.fieldType || '';

        // Allow arrays for PickMany/Checkboxes fields (they have array values like ["Option1", "Option2"])
        if (Array.isArray(value)) {
          // Check if it's a PickMany/Checkboxes field - allow these
          if (fieldType.includes('PickMany') || fieldType.includes('Checkboxes') || fieldType.includes('File')) {
            return true;
          }
          // Exclude other array fields (like File arrays with complex objects)
          return false;
        }

        if (value !== null && typeof value === 'object' && !this.isSimpleObject(value)) return false;
        return true;
      });

    const columns: any[] = fieldsToShow
      .map(fieldName => {
        const fieldDef = getFieldDef(fieldName);
        if (!fieldDef) {
          // Create a default field definition if not found
          return {
            name: fieldName,
            getJson: () => ({ name: fieldName, type: 'com.krista.fields.Text' })
          };
        }
        return fieldDef;
      });

    // Create table data source
    this.tableDataSource = new EntitySearchTableDataSource(
      columns,
      this.searchResults,
      (headerCell, rawValue) => {
        // Action cell clicked
      }
    );

    // Create table config
    const isMultiSelect = this.entitySelectorMeta.isMultiSelect;
    const tableConfig: TableConfig = {
      defaultColumnConfig: {},
      loadStrategy: "Pagination",
      allowEditCells: false,
      stickyHeader: true,
      allowRemoveRows: false,
      showCellSelectionData: true,
      selection: isMultiSelect ? "MULTI SELECT" : "SINGLE",
      pageSize: this.pageSize,
      currentPage: this.currentPage,
      onSelection: new EventEmitter<Set<String>>(),
      onPageChange: new EventEmitter<any>(),
      readonly: false,
      showBorder: true
    };

    // Subscribe to selection changes
    tableConfig.onSelection.subscribe((selectedKeys: Set<String>) => {
      this.handleTableSelection(selectedKeys);
    });

    // Subscribe to page changes
    if (tableConfig.onPageChange) {
      tableConfig.onPageChange.subscribe((event: any) => {
        this.handlePageChange(event);
      });
    }

    // Create table input
    this.tableInput = new TableInput<any[], EntitySearchResult[], TableValueCell>();
    this.tableInput.tableConfig = tableConfig;
    this.tableInput.dataSource = this.tableDataSource;
    this.tableInput.selectedRowKey = new Set(Array.from(this.selectionMap.keys()));
  }

  /**
   * Check if value is a simple object (not a complex nested structure)
   */
  private isSimpleObject(value: any): boolean {
    if (typeof value !== 'object' || value === null) return false;
    // Check if it has nested objects or arrays
    return !Object.values(value).some(v =>
      typeof v === 'object' && v !== null
    );
  }

  /**
   * Handle selection changes from NewTable
   */
  private handleTableSelection(selectedKeys: Set<String>): void {
    if (!this.isMultiSelect) {
      // Single select: find the entity and emit immediately
      const selectedKey = Array.from(selectedKeys)[0];
      if (selectedKey) {
        const entity = this.searchResults.find(e => e.value.meta.primaryKey === selectedKey);
        if (entity) {
          this.save.emit([entity]);
        }
      }
    } else {
      // Multi-select: update selection map for current page only
      // Get keys of entities on the current page
      const currentPageKeys = new Set<string>(
        this.searchResults.map(e => String(e.value.meta.primaryKey))
      );

      // Remove deselected entities from current page
      currentPageKeys.forEach(key => {
        const keyStr = String(key);
        if (!selectedKeys.has(keyStr as any)) {
          this.selectionMap.delete(keyStr);
        }
      });

      // Add newly selected entities from current page
      selectedKeys.forEach(key => {
        const keyStr = String(key);
        if (currentPageKeys.has(keyStr)) {
          const entity = this.searchResults.find(e => String(e.value.meta.primaryKey) === keyStr);
          if (entity) {
            this.selectionMap.set(keyStr, entity);
          }
        }
      });
    }
  }

  /**
   * Handle page change from NewTable
   */
  private handlePageChange(event: any): void {
    const pageIndex = event.pageIndex || 1;
    const pageSize = event.pageSize || this.pageSize;

    // Update page size if changed
    if (pageSize !== this.pageSize) {
      this.pageSize = pageSize;
      this.currentPage = 1; // Reset to first page when page size changes
    } else {
      // Update current page
      this.currentPage = pageIndex;
    }

    // Perform search with updated page
    this.performSearch(false);
  }

  /**
   * TrackBy function for filters to prevent unnecessary DOM recreation
   */
  trackByFilter(index: number, filter: EntitySearchFilter): string {
    return filter.field?.name || index.toString();
  }
}



