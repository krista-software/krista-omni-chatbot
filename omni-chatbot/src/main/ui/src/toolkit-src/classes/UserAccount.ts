import { Icon } from "./Icon";
import { UserPreferences } from "./UserPreferences";
import { Role } from "./Role";

export class UserAccount {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly roles: Role[],
    public readonly preferences: UserPreferences = UserPreferences.createNew(),
    public readonly icon?: Icon
  ) {}

  static fromJSON(json: any): UserAccount | undefined {
    if (!json) {
      return undefined;
    }

    return new UserAccount(
      json["id"],
      json["name"],
      Role.fromJSONArray(json["roles"]),
      UserPreferences.fromJSON(json["preferences"]),
      Icon.create(json["icon"])
    );
  }
}
