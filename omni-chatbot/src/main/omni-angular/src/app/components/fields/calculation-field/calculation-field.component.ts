import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { FieldValidation, VALIDATION_MESSAGES } from '../../../interfaces/field-validation.interface';
import { KristaFieldService } from '../../../services/krista-field.service';

@Component({
  selector: 'app-calculation-field',
  templateUrl: './calculation-field.component.html',
  styleUrls: ['./calculation-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class CalculationFieldComponent implements FieldValidation {
  @Input() field!: FormField;
  @Input() hasError: boolean = false;
  @Input() errorMessage: string = '';
  @Input() readOnly: boolean = false;
  @Input() config: any; // Config input for hideRequiredIndicator support
  @Output() valueChange = new EventEmitter<any>();

  constructor(private kristaFieldService: KristaFieldService) {}

  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  isFieldReadOnly(): boolean {
    // Calculation fields are always readonly as they are computed values
    return true;
  }

  getFormattedValue(): string {
    if (this.isFieldEmpty()) return '';
    
    const value = this.field.value;
    
    // Handle numeric calculations
    if (typeof value === 'number') {
      // Check if it's a percentage field
      if (this.field.attributeValues?.['displayAsPercentage']) {
        return (value * 100).toFixed(2) + '%';
      }
      
      // Check if it's a currency field
      if (this.field.attributeValues?.['displayAsCurrency']) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: this.field.attributeValues?.['currency'] || 'USD'
        }).format(value);
      }
      
      // Default numeric formatting
      const decimalPlaces = this.field.attributeValues?.['decimalPlaces'] || 2;
      return value.toFixed(decimalPlaces);
    }
    
    // Handle string calculations
    return value?.toString() || '';
  }

  // FieldValidation interface implementation
  validateField(): string | null {
    const { isValid, errorMessage } = this.kristaFieldService.validateField(this.field as any, this.field?.value);
    return isValid ? null : (errorMessage || VALIDATION_MESSAGES.enterCorrectValues);
  }

  isFieldEmpty(): boolean {
    return this.field.value === null || 
           this.field.value === undefined || 
           this.field.value === '';
  }

  getDisplayLabel(): string {
    return this.field.name || 'Calculation';
  }

  getTooltip(): string {
    return this.field.attributeValues?.['toolTip'] || '';
  }
}
