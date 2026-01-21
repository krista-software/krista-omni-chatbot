export class UserPreferences {
  public static ConversationMsgDisplayCount = "ConvMsgDisplayCount";

  constructor(private readonly settings: { [key: string]: any }) {}

  get(key: string, defaultValue?: any): any {
    const val = this.settings[key];
    return val !== undefined ? val : defaultValue;
  }

  update(key: string, value: any) {
    this.settings[key] = value;
  }

  toJson() {
    return this.settings;
  }

  static fromJSON(json: any) {
    if (!json) {
      return this.createNew();
    }
    return new UserPreferences(json);
  }

  static createNew() {
    return new UserPreferences({});
  }
}
