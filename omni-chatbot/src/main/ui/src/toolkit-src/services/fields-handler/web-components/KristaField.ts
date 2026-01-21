import { KSDKFormField } from "../../messaging/form/KSDKFormField";
import { FieldsHandlerService } from "../FieldsHandlerService";
import { getMaskedValue } from "../utils/fields";
import { getSanitizedMarkup } from "../utils/sanitize";
import { FieldTypes } from "../state-managers";
import { StreamFieldRenderer } from "../renderers/react/StreamFieldRenderer";
import ReactDOM from "react-dom";
import React from "react";
import { RecoilRoot } from "recoil";

export class KristaField extends HTMLElement {
  constructor() {
    super();
    let attributeMap = JSON.parse("{}");
    try {
      attributeMap = JSON.parse(this.getKristaAttribute("attributes") || "{}");
    } catch (ex) {
      attributeMap = JSON.parse("{}");
    }
    let fieldType = this.getKristaAttribute("fieldtype");
    if (!fieldType) {
      fieldType = "com.krista.fields.Text";
    }
    let value: any = this.getKristaAttribute("value");
    if (fieldType === "com.krista.fields.Phone") {
      try {
        value = JSON.parse(value);
      } catch {
        // keep the value as it is.
      }
    }
    if (value === "") {
      value = undefined;
    }
    const field = KSDKFormField.fromJSON({
      name: this.getKristaAttribute("name") || "",
      value,
      attributeValues: attributeMap,
      fieldType,
    });
    if (field) {
      const kristaTypeField = FieldsHandlerService.getFieldStateManager(field);
      kristaTypeField.setValue(field.value, false, false);

      // Handle stream fields differently
      if (fieldType === "com.krista.fields.Stream" || fieldType === FieldTypes.STREAM_FIELD) {
        // Create a container for React component
        const container = document.createElement('div');
        this.appendChild(container);

        // Render the StreamFieldRenderer React component wrapped in RecoilRoot
        ReactDOM.render(
          React.createElement(
            RecoilRoot,
            null,
            React.createElement(StreamFieldRenderer, {
              kristaTypeField: kristaTypeField,
              options: { readOnly: true, hideLabel: true }
            })
          ),
          container
        );
      } else if (attributeMap["isSecured"]) {
        this.innerHTML =
          '<span class="KristaField">' +
          getMaskedValue(kristaTypeField.formattedValue) +
          "</span>";
      } else {
        this.innerHTML =
          '<span class="KristaField">' +
          getSanitizedMarkup(kristaTypeField.formattedValue) +
          "</span>";
      }
    }
  }

  private getKristaAttribute(key: string): string {
    return this.getAttribute(key) || "";
  }
}
