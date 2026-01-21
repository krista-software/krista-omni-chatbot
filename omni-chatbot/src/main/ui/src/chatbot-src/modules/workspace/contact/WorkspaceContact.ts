import { KristaId, Icon } from "../../../../toolkit-src";

export class WorkspaceContact {
  constructor(
    public readonly id: KristaId,
    public readonly personId: KristaId,
    public readonly name: string,
    public readonly status: string,
    public readonly icon: Icon | undefined = undefined
  ) {
    this.id = id;
    this.personId = personId;
    this.name = name;
    this.icon = icon;
  }

  static create(json: any): WorkspaceContact | undefined {
    if (!json) {
      return undefined;
    }

    return new WorkspaceContact(
      KristaId.parse(json["accountId"]),
      KristaId.parse(json["personId"]),
      json["name"],
      json["status"],
      Icon.create(json["icon"])
    );
  }
}
