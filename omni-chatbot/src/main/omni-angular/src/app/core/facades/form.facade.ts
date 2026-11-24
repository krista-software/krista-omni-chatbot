import { Injectable } from '@angular/core';
import { FormField } from '../../../ui-toolkit-src-angular';
import { KristaFieldService } from '../../services/krista-field.service';
import { KristaFieldFactoryService } from '../../services/krista-field-factory.service';
import { ConfigService } from '../../services/config.service';
import { StorageService } from '../../services/storage.service';
import { FieldTypeService } from '../../services/field-type.service';
import { KristaField } from '../../models/krista-field.model';

/**
 * Form Facade Service
 * 
 * Provides a simplified interface for form-related operations.
 * Reduces the number of dependencies that components need to inject.
 * 
 * This facade encapsulates:
 * - KristaField creation and management
 * - Field value transformation
 * - Configuration access
 * - Field type detection
 * 
 * Benefits:
 * - Reduces component complexity
 * - Provides a single point of access for form operations
 * - Easier to test and mock
 * - Follows Facade Pattern
 */
@Injectable({
  providedIn: 'root'
})
export class FormFacade {

  constructor(
    private kristaFieldService: KristaFieldService,
    private kristaFieldFactory: KristaFieldFactoryService,
    private configService: ConfigService,
    private storageService: StorageService,
    public fieldTypeService: FieldTypeService
  ) {}

  // ============================================================================
  // KristaField Operations
  // ============================================================================

  /**
   * Create a KristaField instance for a FormField
   */
  createKristaField(field: FormField): KristaField {
    return this.kristaFieldFactory.create(field);
  }

  /**
   * Create multiple KristaField instances
   */
  createKristaFields(fields: FormField[]): Map<string, KristaField> {
    const kristaFields = new Map<string, KristaField>();
    fields.forEach(field => {
      kristaFields.set(field.name, this.createKristaField(field));
    });
    return kristaFields;
  }

  // ============================================================================
  // Value Transformation
  // ============================================================================

  /**
   * Transform field value for submission to Krista backend
   */
  getKristaValue(field: FormField, value: any): any {
    return this.kristaFieldService.getKristaValue(field, value);
  }

  /**
   * Get formatted display value for a field
   */
  getFormattedValue(field: FormField, value: any): string {
    return this.kristaFieldService.getFormattedValue(field, value);
  }

  /**
   * Format value on blur (apply formatting rules)
   */
  formatOnBlur(field: FormField, value: any): any {
    return this.kristaFieldService.formatOnBlur(field, value);
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  /**
   * Get current workspace ID
   */
  getWorkspaceId(): string {
    return this.configService.getCurrentConfig()?.workspaceId || '';
  }

  /**
   * Get client session ID
   */
  getClientSessionId(): string {
    return this.storageService.getClientSessionId() || '';
  }

  /**
   * Get account ID
   * Note: Account ID is typically stored in the config object's nested properties
   */
  getAccountId(): string {
    const config = this.configService.getCurrentConfig();
    // Access from config.config if available, or return empty string
    return (config?.config as any)?.kristaAccountId || '';
  }

  // ============================================================================
  // Field Type Detection (delegated to FieldTypeService)
  // ============================================================================

  /**
   * Check if field is a text field
   */
  isTextField(field: FormField): boolean {
    return this.fieldTypeService.isTextField(field);
  }

  /**
   * Check if field is a number field
   */
  isNumberField(field: FormField): boolean {
    return this.fieldTypeService.isNumberField(field);
  }

  /**
   * Check if field is a multi-field (composite)
   */
  isMultiField(field: FormField): boolean {
    return this.fieldTypeService.isMultiField(field);
  }

  /**
   * Check if field should bypass KristaField formatting
   */
  isBypassField(field: FormField): boolean {
    return this.fieldTypeService.isBypassField(field);
  }

  // ============================================================================
  // Validation Helpers
  // ============================================================================

  /**
   * Check if a field value is empty
   */
  isFieldEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  /**
   * Get default value for a field based on its type
   */
  getDefaultFieldValue(field: FormField): any {
    if (this.fieldTypeService.isSwitchField(field)) {
      return false;
    }
    if (this.fieldTypeService.isCheckboxesField(field)) {
      return [];
    }
    return null;
  }
}

