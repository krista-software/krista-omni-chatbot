export class KSDKAccount {
  constructor(readonly id: string, readonly name: string) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
    };
  }

  static fromJSON(json: any): KSDKAccount {
    return new KSDKAccount(json["id"], json["name"]);
  }
}
