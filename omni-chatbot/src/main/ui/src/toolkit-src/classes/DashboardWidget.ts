import { KSDKForm } from "./../services/messaging/form/KSDKForm";
import { WidgetMeta } from "../client-api/protocols/rest/types";

export class DashboardWidget {
  constructor(
    public readonly id: string,
    public readonly conversationDefinitionId: string,
    public readonly widgetMeta: WidgetMeta,
    public readonly inputForm: KSDKForm,
    public readonly widgetForm: KSDKForm
  ) {}

  static fromJSON(json: any): DashboardWidget | undefined {
    if (!json) {
      return undefined;
    }

    return new DashboardWidget(
      json["id"],
      json["conversationDefinitionId"],
      json["widgetMeta"],
      KSDKForm.fromJSON(json["inputForm"])!,
      KSDKForm.fromJSON(json["widgetForm"])!
    );
  }

  static fromJSONArray(jsonArray: any[]): DashboardWidget[] {
    if (!jsonArray) {
      return [];
    }

    const widgets = new Array<DashboardWidget>();
    jsonArray.forEach((json) => {
      const widget = this.fromJSON(json);
      if (widget) {
        widgets.push(widget);
      }
    });
    return widgets;
  }
}
