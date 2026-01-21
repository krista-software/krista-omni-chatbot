import { Priorities } from "./Priorities";
import { UITechnology } from "./renderers/types";
import { CalculationFieldRenderer } from "./renderers";
import { DateFieldRenderer } from "./renderers";
import { DateTimeFieldRenderer } from "./renderers";
import { DateRangeFieldRenderer } from "./renderers";
import { DateTimeRangeFieldRenderer } from "./renderers";
import { LabelFieldRenderer } from "./renderers";
import { ListFieldRenderer } from "./renderers";
import { LocationFieldRenderer } from "./renderers";
import { CompositeFieldRenderer } from "./renderers";
import { NumberFieldRenderer } from "./renderers";
import { PhoneFieldRenderer } from "./renderers";
import { PickListFieldRenderer } from "./renderers";
import { PickOneFieldRenderer } from "./renderers";
import { RatingFieldRenderer } from "./renderers";
import { RichTextFieldRenderer } from "./renderers";
import { SelectionFieldRenderer } from "./renderers";
import { SwitchFieldRenderer } from "./renderers";
import { TableFieldRenderer } from "./renderers";
import { TextFieldRenderer } from "./renderers";
import { TimeFieldRenderer } from "./renderers";
import { FileFieldRenderer } from "./renderers";
import { UnknownFieldRenderer } from "./renderers";
import { KristaFieldAttributes } from "./state-managers";
import { KristaValue } from "./state-managers";
import { KristaTypeField } from "./state-managers";
import { KristaFieldRenderer } from "./types";
import { StreamFieldRenderer } from "./renderers/react/StreamFieldRenderer";

export type RendererObj = { renderer: any };

export function getRenderer(
  field: KristaTypeField<KristaFieldAttributes, KristaValue>,
  framework: UITechnology
): KristaFieldRenderer {
  // defining this array outside the function is causing circular dependency.
  // static circular dependency should not cause any problems if you are not using them immediately.
  // this array will be created only when the containing method is called
  const reactFields: RendererObj[] = [
    { renderer: CalculationFieldRenderer },
    { renderer: DateFieldRenderer },
    { renderer: DateTimeFieldRenderer },
    { renderer: DateRangeFieldRenderer },
    { renderer: DateTimeRangeFieldRenderer },
    { renderer: LabelFieldRenderer },
    { renderer: ListFieldRenderer },
    { renderer: LocationFieldRenderer },
    { renderer: CompositeFieldRenderer },
    { renderer: NumberFieldRenderer },
    { renderer: PhoneFieldRenderer },
    { renderer: PickListFieldRenderer },
    { renderer: PickOneFieldRenderer },
    { renderer: RatingFieldRenderer },
    { renderer: RichTextFieldRenderer },
    { renderer: SelectionFieldRenderer },
    { renderer: SwitchFieldRenderer },
    { renderer: TableFieldRenderer },
    { renderer: TextFieldRenderer },
    { renderer: TimeFieldRenderer },
    { renderer: FileFieldRenderer },
    { renderer: StreamFieldRenderer },
  ];
  let allFields: RendererObj[] = [];
  if (framework === "react") {
    allFields = reactFields;
  }
  const priorities: {
    priority: Priorities;
    renderer: any;
  }[] = allFields
    .map((fieldObj) => {
      const fieldRenderer = fieldObj.renderer;
      if (fieldRenderer.getPriority) {
        return {
          priority: fieldRenderer.getPriority(field) as Priorities,
          renderer: fieldRenderer,
        };
      } else {
        return {
          priority: Priorities.NotSupported,
          renderer: fieldRenderer,
        };
      }
    })
    .filter((priorityObj) => priorityObj.priority !== Priorities.NotSupported);

  if (priorities.length > 0) {
    let selected = priorities[0];
    priorities.forEach((item) => {
      if (item.priority > selected.priority) {
        selected = item;
      }
    });
    return selected.renderer;
  }
  return UnknownFieldRenderer;
}
