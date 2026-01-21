import { Icon } from "./Icon";
import { UserAccount } from "./UserAccount";
import { WorkspaceAuthentication } from "./WorkspaceAuthentication";

export class UnauthorizedWorkspace {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string,
    public userAccount: UserAccount,
    public authentication: WorkspaceAuthentication,
    public icon?: Icon
  ) {}

  static create(json: any): UnauthorizedWorkspace | undefined {
    if (!json) {
      return undefined;
    }

    return new UnauthorizedWorkspace(
      json["id"],
      json["name"],
      json["description"],
      UserAccount.fromJSON(json["userAccount"])!,
      WorkspaceAuthentication.fromJSON(json["authentication"]),
      Icon.create(json["icon"])
    );
  }
}
