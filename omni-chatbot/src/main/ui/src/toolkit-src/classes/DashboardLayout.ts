import {
  GraphCategory,
  GraphStyle,
} from "./../client-api/protocols/rest/types";

export class DashboardLayout {
  constructor(
    public readonly widgetId: string,
    public readonly size: string,
    public readonly graphStyle: GraphStyle,
    public readonly graphCategory?: GraphCategory
  ) {}

  static fromJSON(json: any): DashboardLayout | undefined {
    if (!json) {
      return undefined;
    }

    return new DashboardLayout(
      json["widgetId"],
      json["size"],
      json["graphStyle"],
      json["graphCategory"]
    );
  }

  static fromJSONArray(jsonArray: any[]): DashboardLayout[] {
    if (!jsonArray) {
      return [];
    }

    const layoutArray = new Array<DashboardLayout>();
    jsonArray.forEach((json) => {
      const layout = this.fromJSON(json);
      if (layout) {
        layoutArray.push(layout);
      }
    });
    return layoutArray;
  }
}
