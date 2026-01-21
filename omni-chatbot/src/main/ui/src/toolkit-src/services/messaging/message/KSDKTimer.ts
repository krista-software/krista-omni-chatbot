type TimerAction = "freeze" | "delete";
export class KSDKTimer {
  constructor(
    readonly startTime: number,
    readonly endTime: number,
    readonly action: TimerAction
  ) {}

  static fromJSON(json: any): KSDKTimer | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKTimer(json["start"], json["end"], json["action"]);
  }
}
