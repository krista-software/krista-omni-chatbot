import { KristaId } from "../../../common/KristaId";
import { isDefined } from "../../../common/utils";

export class SocketRequest {
  constructor(
    readonly transactionId: KristaId,
    readonly requestTime: number = new Date().valueOf()
  ) {}

  toJSON(): any {
    return {
      transactionId: this.transactionId.toString(),
      requestTime: this.requestTime,
    };
  }

  static fromJSON(json: any): SocketRequest | undefined {
    if (!isDefined(json)) {
      return undefined;
    }
    return new SocketRequest(
      KristaId.parse(json["transactionId"]),
      json["requestTime"]
    );
  }
}
