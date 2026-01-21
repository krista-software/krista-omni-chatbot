import { KristaId } from "../../../common/KristaId";
import { KSDKExecution as Execution } from "../message/KSDKExecution";
import { DbMessages, InboxStateInfo } from "./DbMessages";
import {
  DrainRequest,
  DrainResponse,
  MessageNetworkDataSource,
  PageState,
} from "./MessageNetworkDataSource";
import { InboxCallbackResult } from "./IMessageDataSource";
import { newGuid } from "../../../common/utils";
import { GetExecutionsParams } from "../../../client-api/protocols/rest/types";

export class ConversationsNetworkDataSource extends MessageNetworkDataSource<Execution> {
  public readonly objectId = newGuid();
  protected _type = "executions";
  constructor(workspaceId: KristaId, inboxId: KristaId) {
    super(workspaceId, inboxId);
  }

  getDrainRequestPayload(
    offsetId: string,
    before: number,
    after: number
  ): { payload: GetExecutionsParams; updatedRequest: DrainRequest } {
    let _before: number = offsetId || before > 0 ? before : after;
    const _after = after;
    const updatedRequest: DrainRequest = {
      offsetId: offsetId,
      before: _before,
      after: _after,
    };
    const payload: GetExecutionsParams = {
      workspaceId: this.workspaceId.toString(),
      inboxId: KristaId.createInboxId(this.inboxId).toString(),
      conversationOffset: offsetId ? offsetId : undefined,
      before: _before,
      after: _after,
      inclusiveOffset: !!(offsetId && _before > 0 && _after > 0),
    };
    return { payload: payload, updatedRequest: updatedRequest };
  }

  onResponse(
    drainRequest: DrainRequest,
    response: DrainResponse<Execution> | undefined,
    pageState: PageState,
    callback: InboxCallbackResult<Execution>
  ) {
    // consoleLog("Network Source -: onResponse - ", this.objectId);

    const conversationMessages = response?.messages || [];
    const table = DbMessages.getInstance().getConversationTable(this.inboxId);
    this.insertMessageToTable(table, drainRequest, conversationMessages);
    callback(pageState.event, { messages: conversationMessages });
  }

  getPageStateInfo(): InboxStateInfo {
    return DbMessages.getInstance().getConversationPageState(this.inboxId);
  }

  parseResponse(payload: any): DrainResponse<Execution> | undefined {
    return ConversationMessageDrainResponse.fromJSON(payload);
  }
}

export class ConversationMessageDrainResponse
  implements DrainResponse<Execution>
{
  constructor(
    readonly workspaceId: KristaId,
    readonly inboxId: KristaId,
    readonly pageTop: string,
    readonly pageBottom: string,
    readonly messages: Execution[]
  ) {}

  static fromJSON(json: any): ConversationMessageDrainResponse | undefined {
    if (!json) {
      return undefined;
    }
    return new ConversationMessageDrainResponse(
      KristaId.parse(json["workspaceId"]),
      KristaId.parse(json["inboxId"]),
      json["pageTop"],
      json["pageBottom"],
      Execution.fromJSONArray(json["conversations"].map(convertToNewStructure)) // platform to ksdk conversion
    );
  }
}

// DELETE THIS CODE
function convertToNewStructure(message: any) {
  const json: any = {};
  json["id"] = message["executionId"];
  json["title"] = message["conversationTitle"];
  json["name"] = message["conversationName"];
  json["state"] = message["state"];
  json["mode"] = message["executionMode"];
  json["startTime"] = message["conversationStartTime"];
  json["endTime"] = message["conversationEndTime"];
  const oldLastMessage = message["lastMessage"];
  const newLastMessage: any = {
    summary: oldLastMessage.summary,
    creationTime: oldLastMessage.sendTime,
  };
  if (oldLastMessage.sender) {
    newLastMessage.sender = {
      id: oldLastMessage.sender.accountId,
      name: oldLastMessage.sender.name,
    };
  } else {
    newLastMessage.sender = {
      id: "wsContact_1df926cb-ab93-444e-88ba-0d3591d56242",
      name: "Krista",
    };
  }
  const participants = message["participants"];
  if (participants.length > 0) {
    const participant: any = participants[0];
    json["initiator"] = {
      id: participant.accountId,
      name: participant.name,
    };
  }
  json["lastMessage"] = newLastMessage;
  return json;
}
