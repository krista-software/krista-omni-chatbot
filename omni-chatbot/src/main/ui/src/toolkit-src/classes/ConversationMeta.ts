import { Icon } from "./Icon";

export class ConversationMeta {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly mode: "draft" | "test" | "deploy",
    public readonly description: string,
    public readonly icon?: Icon
  ) {}

  static fromJSON(json: any): ConversationMeta | undefined {
    if (!json) {
      return undefined;
    }

    return new ConversationMeta(
      json["id"],
      json["name"],
      json["mode"],
      json["description"],
      Icon.create(json["icon"])
    );
  }

  static fromJSONArray(jsonArray: any[]): ConversationMeta[] {
    if (!jsonArray) {
      return [];
    }

    const metaArray = new Array<ConversationMeta>();
    jsonArray.forEach((json) => {
      const meta = this.fromJSON(json);
      if (meta) {
        metaArray.push(meta);
      }
    });
    return metaArray;
  }
}
