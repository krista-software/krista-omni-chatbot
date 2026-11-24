import { FormField } from './message.model';

/**
 * Entity type information
 */
export interface EntityType {
  entityId: string;
  entityName: string;
  registry: {
    invokerId: string;
    catalogId: string;
    ecosystemId: string;
    domainId: string;
  };
}

/**
 * Entity definition with fields
 * Note: Backend sends fields as object, but we convert to array in parser
 */
export interface EntityDefinition {
  name: string;
  entityType: EntityType;
  options: { [key: string]: any };
  fields: FormField[] | { [key: string]: any };
}

/**
 * Entity metadata
 */
export interface EntityMeta {
  entityType?: EntityType;
  primaryKey?: string;
}

/**
 * Entity value structure
 */
export interface EntityValue {
  meta: EntityMeta;
  fields: { [fieldId: string]: any };
  textSummary?: string;
}

/**
 * Entity search filter configuration
 */
export interface EntitySearchFilter {
  field: FormField;
  timeout?: number;
}

/**
 * Entity selector metadata
 * Parsed from field.attributeValues
 */
export interface EntitySelectorMeta {
  invokerId: string;
  selectionSize: string;
  isMultiSelect: boolean;
  allowDefaultSearch: boolean;
  defaultSearchTimeout?: number;
  availableFilters: EntitySearchFilter[];
  entityTypeDomain?: EntityType;
  entityDefinition?: EntityDefinition;
  invokeAsUser: boolean;
  entityName: string;
}

/**
 * Helper class to parse EntitySelectorMeta from attributeValues
 */
export class EntitySelectorMetaParser {
  static parse(attributeValues: { [key: string]: any }): EntitySelectorMeta | undefined {
    if (!attributeValues) {
      return undefined;
    }

    const invokerId = attributeValues['invokerId'];
    const selectionSize = attributeValues['selectionSize'];
    const allowDefaultSearch = attributeValues['allowDefaultSearch'] || false;
    const defaultSearchTimeout = attributeValues['defaultSearchTimeout'];
    const invokeAsUser = attributeValues['invokeAsUser'] || false;

    // Parse entity type domain
    const entityTypeDomain = attributeValues['entityTypeDomain'] as EntityType | undefined;

    // Parse entity definition
    const entityDefinition = attributeValues['entityDefinition'] as EntityDefinition | undefined;

    // Determine if multi-select based on selectionSize
    const isMultiSelect = selectionSize ? selectionSize !== '1' : false;

    // Get entity name from entityTypeDomain
    const entityName = entityTypeDomain?.entityName || '';

    // Convert entityDefinition.fields from object to array if needed
    // Backend sends fields as object (key-value pairs), but we need array
    let fieldsArray: FormField[] = [];
    if (entityDefinition && entityDefinition.fields) {
      if (Array.isArray(entityDefinition.fields)) {
        fieldsArray = entityDefinition.fields;
      } else {
        // Convert object to array using Object.values()
        fieldsArray = Object.values(entityDefinition.fields) as FormField[];
        entityDefinition.fields = fieldsArray;
      }
    }

    // Parse filters
    const filtersArray = attributeValues['filters'] || [];
    const availableFilters: EntitySearchFilter[] = [];

    if (entityDefinition && Array.isArray(filtersArray)) {
      filtersArray.forEach((filterConfig: any) => {
        const fieldName = filterConfig['fieldName'];
        const timeout = filterConfig['timeout'];

        // Find the field in entity definition
        const field = fieldsArray.find((f: FormField) => f.name === fieldName);
        if (field) {
          availableFilters.push({
            field,
            timeout
          });
        }
      });
    }

    return {
      invokerId,
      selectionSize,
      isMultiSelect,
      allowDefaultSearch,
      defaultSearchTimeout,
      availableFilters,
      entityTypeDomain,
      entityDefinition,
      invokeAsUser,
      entityName
    };
  }
}

/**
 * Entity search request DTO
 */
export interface EntitySearchDto {
  sourceField: FormField;
  filterFieldName: string;
  value: string;
  page: number;
  count: number;
}

/**
 * Entity search result item
 */
export interface EntitySearchResult {
  value: EntityValue;
  textSummary: string;
  fields: FormField[];
}

/**
 * Entity search response
 */
export interface EntitySearchResponse {
  status: 'success' | 'error' | 'authentication';
  data?: {
    results: EntitySearchResult[];
    hasMore: boolean;
  };
  authentication?: {
    invokerName: string;
    authUrl: string;
  };
  errorMessage?: string;
}

/**
 * Entity selector field configuration
 */
export interface EntitySelectorFieldConfig {
  displayValue: string;
  entitySelectorMeta?: EntitySelectorMeta;
  hasError: boolean;
  errorMessage: string;
  readOnly: boolean;
  showLabel?: boolean; // Whether to show the field label (default: true)
  hideRequiredIndicator?: boolean; // Hide the required asterisk (e.g., for Inform messages)
}

