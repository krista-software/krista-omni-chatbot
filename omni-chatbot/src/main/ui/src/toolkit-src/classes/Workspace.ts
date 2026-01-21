import { Icon } from "./Icon";
import { UserAccount } from "./UserAccount";
import { WorkspaceAuthentication } from "./WorkspaceAuthentication";

export class Workspace {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string,
    public kristaAccountId: string,
    public hasNewMessages: boolean,
    public clientApiEndPoint: string,
    public userAccount: UserAccount,
    public authentication: WorkspaceAuthentication,
    public icon?: Icon
  ) {}

  static create(json: any): Workspace | undefined {
    if (!json) {
      return undefined;
    }

    return new Workspace(
      json["id"],
      json["name"],
      json["description"],
      json["kristaAccountId"],
      json["hasNewMessages"],
      json["clientApiEndPoint"],
      UserAccount.fromJSON(json["userAccount"])!,
      WorkspaceAuthentication.fromJSON(json["authentication"]),
      Icon.create(json["icon"])
    );
  }
}
