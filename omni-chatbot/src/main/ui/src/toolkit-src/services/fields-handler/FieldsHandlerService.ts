import { KSDKFormField } from "./../messaging/form/KSDKFormField";
import { getRenderer } from "./Renderer";
import { UITechnology } from "./renderers/types";
import { KristaFieldAttributes } from "./state-managers/field-attributes/KristaFieldAttributes";
import { KristaValue } from "./state-managers/field-values/KristaValue";
import { KristaTypeField } from "./state-managers/fields/KristaTypeField";
import { ICompositeField } from "./state-managers/fields/types";
import { StateManager } from "./StateManager";
import { KristaFieldRenderer } from "./types";

/**
 * @abstract
 * A service class that provides methods for managing and rendering fields.
 */
export abstract class FieldsHandlerService {
  /**
   * A static method that returns a state manager for the given field and its parent (if specified).
   * @static
   * @template T
   * @param {KSDKFormField} field - The field to get a state manager for.
   * @param {ICompositeField} [parent] - The parent of the field (if specified).
   * @returns {T} The state manager for the given field.
   */
  public static getFieldStateManager<
    T extends KristaTypeField<KristaFieldAttributes, KristaValue>
  >(field: KSDKFormField, parent?: ICompositeField): T {
    return StateManager.getStateManager(field, parent);
  }

  /**
   * A static method that returns a renderer for the given field using the specified UI technology.
   * @static
   * @param {KristaTypeField<KristaFieldAttributes, KristaValue>} field - The field to get a renderer for.
   * @param {UITechnology} [framework="react"] - The UI technology to use for rendering the field.
   * @returns {KristaFieldRenderer} The renderer for the given field.
   */
  public static getFieldRenderer(
    field: KristaTypeField<KristaFieldAttributes, KristaValue>,
    framework: UITechnology = "react"
  ): KristaFieldRenderer {
    return getRenderer(field, framework);
  }
}
