export class KSDKTargetAudience {
  constructor(
    readonly accountIds: string[],
    readonly roleIds?: string[],
    readonly attributes?: { [key: string]: string[] }
  ) {}

  toJSON(): any {
    return {
      accountIds: this.accountIds,
      roleIds: this.roleIds,
      attributes: this.attributes,
    };
  }

  static fromJSON(json: any): KSDKTargetAudience | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKTargetAudience(
      json["accountIds"],
      json["roleIds"],
      json["attributes"]
    );
  }

  static createTargetAudience(
    id: string | string[] | undefined
  ): KSDKTargetAudience | undefined {
    if (!id) {
      return undefined;
    } else if (Array.isArray(id)) {
      return new KSDKTargetAudience(id);
    } else {
      return new KSDKTargetAudience([id]);
    }
  }
}
