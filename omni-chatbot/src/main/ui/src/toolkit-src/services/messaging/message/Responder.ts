import { KristaId } from "../../../common/KristaId";

export class Responder {
  constructor(
    public readonly accountId: KristaId,
    public readonly targetMessageId: KristaId,
    public readonly responseTime: number,
    public readonly requiredResponseCount: number,
    public readonly currentResponseCount: number
  ) {}

  public static fromJSON(json: any | Map<string, any>): Responder | undefined {
    if (!json) {
      return undefined;
    }
    let jsonObj = json as any;
    if (json instanceof Map) {
      jsonObj = Object.fromEntries(json);
    }
    return new Responder(
      KristaId.parse(jsonObj["responder"]),
      KristaId.parse(jsonObj["targetMessageId"]),
      jsonObj["responseTime"],
      json["requiredResponseCount"],
      json["currentResponseCount"]
    );
  }
}
