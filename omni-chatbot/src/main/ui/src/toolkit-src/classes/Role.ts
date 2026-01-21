export class Role {
  constructor(public readonly id: string, public name: string) {}

  static fromJSON(json: any): Role | undefined {
    if (!json) {
      return undefined;
    }

    return new Role(json["id"], json["name"]);
  }

  static fromJSONArray(jsonArray: any[]): Role[] {
    if (!jsonArray) {
      return [];
    }

    const roles = new Array<Role>();
    jsonArray.forEach((json) => {
      const role = this.fromJSON(json);
      if (role) {
        roles.push(role);
      }
    });
    return roles;
  }
}
