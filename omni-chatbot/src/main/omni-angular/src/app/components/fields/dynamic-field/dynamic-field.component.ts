import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, AfterViewInit, ElementRef } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { TextFieldConfig, BasicFieldConfig, AddressFieldConfig, LocationFieldConfig, FileFieldConfig, RichTextFieldConfig } from '../../../models/field-config.model';
import { KristaField } from '../../../models/krista-field.model';
import { EntitySelectorMetaParser } from '../../../models/entity.model';
import { StreamProvider } from '@krista/field-types/core/services/stream/StreamProvider';
import { StreamEvent } from '@krista/field-types/core/value-schema/stream/StreamEvent';
import { ConfigService } from '../../../services/config.service';
import { StorageService } from '../../../services/storage.service';
import { createMediaUrlDownload } from '../../../utils/media-url.util';

/**
 * DynamicFieldComponent - A universal field renderer that dynamically renders
 * the appropriate field component based on the field's fieldType.
 *
 * This component eliminates code duplication by centralizing all field rendering
 * logic in one place. It's used by both form-message and multi-field components.
 *
 * Benefits:
 * - Single source of truth for field rendering
 * - Reduces code duplication (~500 lines → ~100 lines)
 * - Easier to maintain and extend
 * - Consistent behavior across all contexts
 */
/**
 * Stream field value structure matching backend's StreamValueJson
 */
interface StreamValueJson {
  streamId: string;
  firstEvent: StreamEvent;
  finished: boolean;
}

@Component({
  selector: 'app-dynamic-field',
  templateUrl: './dynamic-field.component.html',
  styleUrls: ['./dynamic-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class DynamicFieldComponent implements AfterViewInit {
  // Field data
  @Input() field!: FormField;

  // When true, auto-focus this field's input once it renders. The caller decides
  // eligibility (see FormMessageComponent.shouldAutoFocus / FOCUSABLE_FIELD_TYPES).
  @Input() autoFocus: boolean = false;

  // Stream provider instance (singleton)
  private streamProvider?: StreamProvider;

  // Field configurations (different field types need different configs)
  @Input() textFieldConfig?: TextFieldConfig;
  @Input() numberFieldConfig?: TextFieldConfig;
  @Input() richTextFieldConfig?: RichTextFieldConfig;
  @Input() basicFieldConfig?: BasicFieldConfig;
  @Input() addressFieldConfig?: AddressFieldConfig;
  @Input() locationFieldConfig?: LocationFieldConfig;
  @Input() fileFieldConfig?: FileFieldConfig;

  // Address field specific inputs
  @Input() addressValue?: any;

  // MultiField specific inputs
  @Input() subFields?: FormField[];
  @Input() multiFieldConfig?: BasicFieldConfig;
  @Input() kristaFields?: Map<string, KristaField>;
  @Input() hasAttemptedSubmit?: boolean;
  @Input() workspaceId?: string;
  @Input() clientSessionId?: string;

  // Compact mode for table cells
  @Input() compact: boolean = false;

  // Event outputs
  @Output() valueChange = new EventEmitter<any>();
  @Output() blur = new EventEmitter<any>();
  @Output() focus = new EventEmitter<void>();
  @Output() keyPress = new EventEmitter<KeyboardEvent>();
  @Output() subFieldBlur = new EventEmitter<any>();
  @Output() subFieldValueChange = new EventEmitter<any>();

  /**
   * Get text field config - use provided config or create from basicFieldConfig
   */
  getTextConfig(): TextFieldConfig {
    if (this.textFieldConfig) {
      return this.textFieldConfig;
    }

    // Fallback: create config from basicFieldConfig
    // Use displayValue from basicFieldConfig if provided, otherwise leave undefined
    // so that text field falls back to using field.value
    return {
      displayValue: this.basicFieldConfig?.displayValue !== undefined ? this.basicFieldConfig.displayValue : undefined as any,
      inputType: 'text',
      hasError: this.basicFieldConfig?.hasError || false,
      errorMessage: this.basicFieldConfig?.errorMessage || '',
      readOnly: this.basicFieldConfig?.readOnly || this.field.readOnly || false,
      showLabel: this.basicFieldConfig?.showLabel, // Pass through showLabel from basicFieldConfig
      hideRequiredIndicator: this.basicFieldConfig?.hideRequiredIndicator,
      rows: 1 // Reduced from 4 to 2 for normal height
    };
  }

  /**
   * Get number field config - use provided config or create from basicFieldConfig
   */
  getNumberConfig(): TextFieldConfig {
    if (this.numberFieldConfig) {
      return this.numberFieldConfig;
    }

    // Fallback: create config from basicFieldConfig
    // Use displayValue from basicFieldConfig if provided, otherwise leave undefined
    // so that number field falls back to using field.value
    return {
      displayValue: this.basicFieldConfig?.displayValue !== undefined ? this.basicFieldConfig.displayValue : undefined as any,
      inputType: 'text',
      hasError: this.basicFieldConfig?.hasError || false,
      errorMessage: this.basicFieldConfig?.errorMessage || '',
      readOnly: this.basicFieldConfig?.readOnly || this.field.readOnly || false,
      showLabel: this.basicFieldConfig?.showLabel, // Pass through showLabel from basicFieldConfig
      hideRequiredIndicator: this.basicFieldConfig?.hideRequiredIndicator,
      rows: 1
    };
  }

  /**
   * Get rich text field config - use provided config or create from basicFieldConfig
   */
  getRichTextConfig(): RichTextFieldConfig {
    if (this.richTextFieldConfig) {
      return this.richTextFieldConfig;
    }

    // Fallback: create config from basicFieldConfig
    return {
      displayValue: this.basicFieldConfig?.displayValue !== undefined ? this.basicFieldConfig.displayValue : '',
      hasError: this.basicFieldConfig?.hasError || false,
      errorMessage: this.basicFieldConfig?.errorMessage || '',
      readOnly: this.basicFieldConfig?.readOnly || this.field.readOnly || false,
      showLabel: this.basicFieldConfig?.showLabel, // Pass through showLabel from basicFieldConfig
      hideRequiredIndicator: this.basicFieldConfig?.hideRequiredIndicator,
      maxLineCount: 2,
      compact: this.compact // Pass through compact mode from dynamic-field input
    };
  }

  /**
   * Get address value - use provided addressValue or fall back to field.value
   * This ensures address sub-fields have access to the full address object
   * even when rendered inside table cells (which don't pass addressValue)
   */
  getAddressValue(): any {
    if (this.addressValue !== undefined && this.addressValue !== null) {
      return this.addressValue;
    }
    // Fallback to field.value for table cell rendering
    const val = this.field.value;
    if (val && typeof val === 'object') {
      return val;
    }
    return {};
  }

  /**
   * Get address field config - use provided config or create from basicFieldConfig
   */
  getAddressConfig(): AddressFieldConfig {
    if (this.addressFieldConfig) {
      return this.addressFieldConfig;
    }

    // Fallback: create config from basicFieldConfig (e.g., when inside table cell)
    const addrValue = this.field.value;
    return {
      streetDisplayValue: addrValue?.street || '',
      street2DisplayValue: addrValue?.street2 || '',
      cityDisplayValue: addrValue?.city || '',
      stateDisplayValue: addrValue?.state || '',
      countryDisplayValue: addrValue?.country || '',
      postalCodeDisplayValue: addrValue?.postalCode || '',
      hasError: this.basicFieldConfig?.hasError || false,
      errorMessage: this.basicFieldConfig?.errorMessage || '',
      readOnly: this.basicFieldConfig?.readOnly || this.field.readOnly || false,
      showLabel: this.basicFieldConfig?.showLabel,
      hideRequiredIndicator: this.basicFieldConfig?.hideRequiredIndicator
    };
  }

  /**
   * Get location field config - use provided config or create from basicFieldConfig
   */
  getLocationConfig(): LocationFieldConfig {
    if (this.locationFieldConfig) {
      return this.locationFieldConfig;
    }

    // Fallback: create config from basicFieldConfig (e.g., when inside table cell)
    const locationValue = this.field.value;
    let displayValue = '';
    if (locationValue && typeof locationValue === 'object' && locationValue.latitude !== undefined) {
      if (locationValue.address) {
        displayValue = locationValue.address;
      } else if (locationValue.city || locationValue.country) {
        displayValue = [locationValue.area, locationValue.city, locationValue.state, locationValue.zip, locationValue.country].filter((p: any) => p).join(', ');
      } else {
        displayValue = `${locationValue.latitude}, ${locationValue.longitude}`;
      }
    } else if (locationValue) {
      displayValue = String(locationValue);
    }

    return {
      displayValue,
      allowMapSelection: this.field.attributeValues?.['allowMapSelection'] || false,
      hasError: this.basicFieldConfig?.hasError || false,
      errorMessage: this.basicFieldConfig?.errorMessage || '',
      readOnly: this.basicFieldConfig?.readOnly || this.field.readOnly || false,
      showLabel: this.basicFieldConfig?.showLabel,
      hideRequiredIndicator: this.basicFieldConfig?.hideRequiredIndicator
    };
  }

  /**
   * Get file field config - use provided config or create from basicFieldConfig
   */
  getFileConfig(): FileFieldConfig {
    if (this.fileFieldConfig) {
      return this.fileFieldConfig;
    }

    // Fallback: create config from basicFieldConfig
    return {
      workspaceId: this.workspaceId || 'default',
      clientSessionId: this.clientSessionId || '',
      hasError: this.basicFieldConfig?.hasError || false,
      errorMessage: this.basicFieldConfig?.errorMessage || '',
      readOnly: this.basicFieldConfig?.readOnly || this.field.readOnly || false,
      showLabel: this.basicFieldConfig?.showLabel, // Pass through showLabel from basicFieldConfig
      hideRequiredIndicator: this.basicFieldConfig?.hideRequiredIndicator
    };
  }

  /**
   * Get the field category for rendering
   * Maps field types to component categories
   */
  getFieldCategory(): string {
    const fieldType = this.field.fieldType;

    // Entity Selection field (picker/search modal) - Check BEFORE MultiField
    // Note: Backend uses 'com.krista.fields.Entity' for EntitySelection (picker)
    // and 'com.krista.fields.EntityReference' for EntityRenderer (composite)
    if (fieldType === 'com.krista.fields.Entity') {
      return 'entitySelection';
    }

    // Text-based fields
    if (this.isTextFieldType(fieldType)) {
      return 'text';
    }

    // Number-based fields
    if (this.isNumberFieldType(fieldType)) {
      return 'number';
    }

    // Rich Text field (WYSIWYG editor)
    if (fieldType === 'com.krista.fields.RichText') {
      return 'richText';
    }

    // Address compound field
    if (fieldType === 'com.krista.fields.Address') {
      return 'address';
    }

    // MultiField / Composite / EntityReference
    if (this.isMultiFieldType(fieldType)) {
      return 'multi';
    }

    // Date field
    if (fieldType === 'com.krista.fields.Date') {
      return 'date';
    }

    // Date Range field
    if (fieldType === 'com.krista.fields.DateRange') {
      return 'dateRange';
    }

    // Date Time Range field
    if (fieldType === 'com.krista.fields.DateTimeRange') {
      return 'dateTimeRange';
    }

    // Time field
    if (fieldType === 'com.krista.fields.Time') {
      return 'time';
    }

    // Location field
    if (fieldType === 'com.krista.fields.Location') {
      return 'location';
    }

    // Switch field
    if (fieldType === 'com.krista.fields.Switch') {
      return 'switch';
    }

    // Rating field
    if (fieldType === 'com.krista.fields.Rating') {
      return 'rating';
    }

    // Pick One field
    if (fieldType === 'com.krista.fields.PickOne') {
      return 'pickOne';
    }

    // Pick Many field (includes Checkboxes)
    if (fieldType === 'com.krista.fields.PickMany' || fieldType === 'com.krista.fields.Checkboxes') {
      return 'pickMany';
    }

    // File field
    if (fieldType === 'com.krista.fields.File' || fieldType === 'com.krista.fields.Camera') {
      return 'file';
    }

    // Content Stream field (includes Stream field type)
    if (fieldType === 'com.krista.fields.ContentStream' || fieldType === 'com.krista.fields.Stream') {
      return 'contentStream';
    }

    // Label field
    if (fieldType === 'com.krista.fields.Label') {
      return 'label';
    }

    // List field
    if (fieldType === 'com.krista.fields.List') {
      return 'list';
    }

    // Table field
    if (fieldType === 'com.krista.fields.Table') {
      return 'table';
    }

    // Unknown field type
    return 'unknown';
  }

  /**
   * Check if field type uses text field component
   */
  private isTextFieldType(fieldType: string): boolean {
    return [
      'com.krista.fields.Text',
      'com.krista.fields.Email',
      'com.krista.fields.Phone',
      'com.krista.fields.Paragraph',
      'com.krista.fields.ProperNoun',
      'com.krista.fields.Person',
      'com.krista.fields.Identifier',
      'com.krista.fields.Street',
      'com.krista.fields.Street2',
      'com.krista.fields.City',
      'com.krista.fields.State',
      'com.krista.fields.PostalCode',
      'com.krista.fields.Country'
    ].includes(fieldType);
  }

  /**
   * Check if field type uses number field component
   */
  private isNumberFieldType(fieldType: string): boolean {
    return [
      'com.krista.fields.Number',
      'com.krista.fields.Currency',
      'com.krista.fields.Unit',
      'com.krista.fields.Percentage'
    ].includes(fieldType);
  }

  /**
   * Check if field type is a MultiField/Composite/EntityReference
   * Note: 'com.krista.fields.Entity' is EntitySelection (picker), not a composite field
   */
  private isMultiFieldType(fieldType: string): boolean {
    return [
      'com.krista.fields.MultiField',
      'com.krista.fields.Composite',
      'com.krista.fields.EntityReference'
    ].includes(fieldType);
  }

  /**
   * Get label field content (HTML)
   */
  getLabelFieldContent(): string {
    const textMessage = this.field.attributeValues?.['text']?.['message'];
    return textMessage || this.field.name;
  }

  /**
   * Whether this label field displays an image (KR-21121).
   * Wire format matches the toolkit's LabelAttributes: flat attribute keys
   * displayText / displayImage / text / image.
   */
  isLabelImage(): boolean {
    return !!this.field.attributeValues?.['displayImage'];
  }

  /**
   * Image configuration for an image-mode label field. Mirrors the toolkit's
   * KrLabelFieldComponent.imageConfig:
   *   src: image.url → image.src.url → image.src.mediaId (via media download URL)
   *   defaults: fit 'cover', width '100%', height '280px', align 'left'
   *   height: '%' coerced to 'px' (server bug — pixels intended; width
   *   legitimately uses percentages, so only height gets the coercion)
   */
  getLabelImageConfig(): { src: string; fit: string; width: string; height: string; align: string } | null {
    const imageAttr = this.field.attributeValues?.['image'];
    if (!imageAttr) return null;

    let src: string = imageAttr['url'] ?? imageAttr['src']?.['url'] ?? '';
    if (!src && imageAttr['src']?.['mediaId']) {
      const workspaceId = this.configService.getCurrentConfig()?.workspaceId || this.workspaceId || '';
      src = createMediaUrlDownload(workspaceId, imageAttr['src']['mediaId']);
    }

    const rawHeight = imageAttr['height'] ?? '280px';
    const height = typeof rawHeight === 'string' && rawHeight.endsWith('%')
      ? rawHeight.replace(/%$/, 'px')
      : rawHeight;

    return {
      src,
      fit: imageAttr['imageFit'] ?? 'cover',
      width: imageAttr['width'] ?? '100%',
      height,
      align: imageAttr['align'] ?? 'left'
    };
  }

  /**
   * Get entity selector field configuration
   */
  getEntitySelectorFieldConfig(): any {
    const kristaField = this.kristaFields?.get(this.field.name);
    const displayValue = kristaField?.formattedValue || '';
    const validation = kristaField?.isValid;
    const errorMsg = kristaField?.errorMessage || '';

    // Parse entitySelectorMeta from field attributeValues
    const entitySelectorMeta = EntitySelectorMetaParser.parse(this.field.attributeValues || {});

    return {
      displayValue,
      entitySelectorMeta,
      hasError: this.hasAttemptedSubmit && !validation,
      errorMessage: errorMsg,
      // Use basicFieldConfig.readOnly (which includes form-level and message-level readonly) or field-level readOnly
      readOnly: this.basicFieldConfig?.readOnly || this.field.readOnly || false,
      // Propagate showLabel so table cells (showLabel:false — the column header
      // already names the field) don't repeat the label inside the cell.
      showLabel: this.basicFieldConfig?.showLabel,
      hideRequiredIndicator: this.basicFieldConfig?.hideRequiredIndicator
    };
  }

  /**
   * Handle value change event
   */
  onValueChange(value: any): void {
    this.valueChange.emit(value);
  }

  /**
   * Handle blur event
   */
  onBlur(value: any): void {
    this.blur.emit(value);
  }

  /**
   * Handle focus event
   */
  onFocus(): void {
    this.focus.emit();
  }

  /**
   * Handle key press event
   */
  onKeyPress(event: KeyboardEvent): void {
    this.keyPress.emit(event);
  }

  /**
   * Handle sub-field blur event (for address and multi-field)
   */
  onSubFieldBlur(event: any): void {
    this.subFieldBlur.emit(event);
  }

  /**
   * Handle sub-field value change event (for multi-field)
   */
  onSubFieldValueChange(event: any): void {
    this.subFieldValueChange.emit(event);
  }

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngAfterViewInit(): void {
    if (this.autoFocus) {
      // Delay so the field's label/auto-size settles first; focusing immediately
      // distorts the input (floating label overlaps the placeholder/value).
      setTimeout(() => this.applyAutoFocus(), 500);
    }
  }

  /**
   * Focus the first focusable input rendered for this field. The caller
   * (FormMessageComponent.shouldAutoFocus) already restricts this to focusable
   * field types. The rich-text editor (ngx-editor) mounts its contenteditable
   * asynchronously, so retry briefly until it appears.
   */
  private applyAutoFocus(attempt: number = 0): void {
    const focusable = this.elementRef.nativeElement.querySelector<HTMLElement>(
      'textarea, input, [contenteditable="true"]'
    );
    if (focusable) {
      focusable.focus({ preventScroll: true });
      return;
    }
    if (attempt < 10) {
      setTimeout(() => this.applyAutoFocus(attempt + 1), 30);
    }
  }

  /**
   * Get StreamProvider instance (singleton)
   */
  getStreamProvider(): StreamProvider {
    if (!this.streamProvider) {
      const config = this.configService.getCurrentConfig();
      const workspaceId = config.workspaceId || this.workspaceId || '';
      const nodeName = config.nodeName || '';
      const clientSessionId = this.storageService.getClientSessionId() || this.clientSessionId || '';

      this.streamProvider = StreamProvider.getInstance(workspaceId, nodeName, clientSessionId);
    }
    return this.streamProvider;
  }

  /**
   * Parse and get stream value from field.value
   */
  getStreamValue(): StreamValueJson | null {
    if (!this.field.value) {
      console.warn('[DynamicField] getStreamValue - No field value');
      return null;
    }

    try {
      // field.value can be a string (JSON) or already parsed object
      const streamValue = typeof this.field.value === 'string'
        ? JSON.parse(this.field.value)
        : this.field.value;

      if (!streamValue.streamId) {
        console.warn('[DynamicField] getStreamValue - No streamId in value');
        return null;
      }

      return streamValue as StreamValueJson;
    } catch (error) {
      console.error('[DynamicField] getStreamValue - Error parsing stream value:', error);
      return null;
    }
  }
}

