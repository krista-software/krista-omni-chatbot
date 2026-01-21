export class KSDKExecutionMeta {
  constructor(
    public readonly title: string,
    public readonly definitionId: string,
    public readonly executionId: string,
    public readonly stepId: string,
    public readonly flowId: string,
    public readonly executionMode: string,
    public readonly testData: boolean,
    public readonly allowChat: boolean
  ) {}

  toJSON() {
    return {
      title: this.title,
      definitionId: this.definitionId,
      executionId: this.executionId,
      stepId: this.stepId,
      flowId: this.flowId,
      executionMode: this.executionMode,
      testData: this.testData,
      allowChat: this.allowChat,
    };
  }

  static fromJSON(json: any): KSDKExecutionMeta | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKExecutionMeta(
      json["title"],
      json["definitionId"],
      json["executionId"],
      json["stepId"],
      json["flowId"],
      json["executionMode"],
      json["testData"],
      json["allowChat"]
    );
  }
}
