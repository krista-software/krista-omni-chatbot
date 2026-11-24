/**
 * KristaField Web Component
 * 
 * This web component renders field values in message content.
 * It extracts the value from the 'value' attribute and displays it inline.
 * 
 * Usage in HTML:
 * <krista-field value="John Doe" name="name" fieldtype="com.krista.fields.Text"></krista-field>
 * 
 * Renders as: John Doe
 * 
 * Matches original implementation:
 * (originally ported from the React chatbot)
 */

export class KristaFieldElement extends HTMLElement {
  constructor() {
    super();
    
    // Get attributes
    const value = this.getAttribute('value') || '';
    const fieldType = this.getAttribute('fieldtype') || 'com.krista.fields.Text';
    const isSecured = this.getAttribute('attributes')?.includes('"isSecured":true') || false;
    
    // For secured fields, mask the value
    let displayValue = value;
    if (isSecured && value) {
      displayValue = this.maskValue(value);
    }
    
    // Render the value inline (no wrapper span needed for inline display)
    // Using textContent instead of innerHTML for security
    this.textContent = displayValue;
    
    // Add a CSS class for styling if needed
    this.classList.add('krista-field-value');
  }
  
  /**
   * Mask a value for secured fields
   * Matches original's getMaskedValue function
   */
  private maskValue(value: string): string {
    if (!value) return '';
    
    // Show first 2 and last 2 characters, mask the rest
    if (value.length <= 4) {
      return '****';
    }
    
    const firstTwo = value.substring(0, 2);
    const lastTwo = value.substring(value.length - 2);
    const maskedMiddle = '*'.repeat(Math.min(value.length - 4, 10));
    
    return `${firstTwo}${maskedMiddle}${lastTwo}`;
  }
}

// Define the custom element
if (!customElements.get('krista-field')) {
  customElements.define('krista-field', KristaFieldElement);
}

