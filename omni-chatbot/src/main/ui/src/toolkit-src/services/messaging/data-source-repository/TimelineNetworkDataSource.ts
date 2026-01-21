import { KristaId } from "../../../common/KristaId";
import { DbMessages, InboxStateInfo } from "./DbMessages";
import {
  DrainRequest,
  DrainResponse,
  MessageNetworkDataSource,
  PageState,
} from "./MessageNetworkDataSource";
import { InboxCallbackResult, ResultEvent } from "./IMessageDataSource";
import { consoleLog, newGuid } from "../../../common/utils";
import { KSDKMessage as Message } from "../message/KSDKMessage";
import { ConversationSidebars } from "../message/TimelineSidebarInbox";
import { GetMessagesParams } from "../../../client-api/protocols/rest/types";
import { SocketRequest } from "../socket/SocketRequest";

//TODO combine this and ConversationNetworkDataSource
export class TimelineNetworkDataSource extends MessageNetworkDataSource<Message> {
  private initialPendingResult:
    | { messages: Message[]; event: ResultEvent }
    | undefined;
  public readonly objectId = newGuid();

  constructor(workspaceId: KristaId, inboxId: KristaId) {
    super(workspaceId, inboxId);
  }

  getDrainRequestPayload(
    offsetId: string | undefined,
    before: number,
    after: number,
    inclusive: boolean = false
  ): { payload: GetMessagesParams; updatedRequest: DrainRequest } {
    const updatedRequest: DrainRequest = {
      offsetId: offsetId,
      before: before,
      after: after,
    };

    const payload = {
      inboxId: KristaId.createInboxId(this.inboxId).toString(),
      offset: offsetId || undefined, // TODO offset or offsetId
      inclusive,
      pageSize: after > 0 ? after : before > 0 ? -before : 0,
    };
    return { payload: payload, updatedRequest: updatedRequest };
  }

  onResponse(
    drainRequest: DrainRequest,
    response: DrainResponse<Message> | undefined,
    pageState: PageState,
    callback: InboxCallbackResult<Message>
  ) {
    consoleLog("messaging: TimelineNetworkDataSource: onResponse: ", {
      response,
      pageState_isNewTop: pageState.isNewTop,
      pageState_isNewBottom: pageState.isNewBottom,
    });
    // consoleLog("Network Source -: onResponse - ", this.objectId);
    const dbMessages = DbMessages.getInstance();
    const timeLinePageState = this.getPageStateInfo();
    consoleLog(
      "messaging: TimelineNetworkDataSource: onResponse: timeLinePageState: ",
      {
        atTop: timeLinePageState._atTop,
        atBottom: timeLinePageState._atBottom,
      }
    );
    const timelineResponse = response as SessionMessageDrainResponse;

    //     //set initial value of inbox bottom and top from the first successful call
    //     //After first call direction will define which offset should be updated.
    //     if (!timeLinePageState.top) {
    //       timeLinePageState.top = response?.pageTop;
    //     }
    //
    //     if (!timeLinePageState.bottom) {
    //       timeLinePageState.bottom = response?.pageBottom;
    //     }

    // update the top offset for forward drain
    if (drainRequest.after > 0) {
      //       timeLinePageState.top = response?.pageTop;
      const isAtTop =
        timelineResponse && timelineResponse.messageCount < drainRequest.after;
      timeLinePageState._atTop =
        timeLinePageState._atTop || pageState.isNewTop || isAtTop;
    }

    // update the bottom offset for backward drain
    if (drainRequest.before > 0) {
      //       timeLinePageState.bottom = response?.pageBottom;
      const isAtBottom =
        timelineResponse && timelineResponse.messageCount < drainRequest.before;
      timeLinePageState._atBottom =
        isAtBottom && (timeLinePageState._atBottom || pageState.isNewBottom);
    }
    consoleLog(
      "messaging: TimelineNetworkDataSource: onResponse: updated timeLinePageState:",
      {
        atTop: this.getPageStateInfo()._atTop,
        atBottom: this.getPageStateInfo()._atBottom,
      }
    );
    if (
      drainRequest.after > 0 &&
      !timelineResponse.offset &&
      timelineResponse?.messageCount < drainRequest.after
    ) {
      const diff = drainRequest.after - timelineResponse.messageCount;
      this.initialPendingResult = {
        messages: timelineResponse.messages,
        event: pageState.event,
      };
      const newOffsetId = timelineResponse.messages[0]?.getId();
      consoleLog(
        "messaging: TimelineNetworkDataSource: onResponse: not enough messages in nextPage call"
      );
      consoleLog(
        "messaging: ==========================================================="
      );
      consoleLog(
        "messaging: ==========================================================="
      );
      consoleLog(
        "messaging: TimelineNetworkDataSource: onResponse: new request:",
        {
          newOffsetId,
          before: diff,
          after: 0,
          inclusive: true,
        }
      );
      this.getMessages(newOffsetId, diff, 0, callback, true);
      return;
    }

    //make split message of user submitted message
    const allMessages: Message[] = [];
    timelineResponse.messages.forEach((msg) => {
      allMessages.push(msg);
      const splitMessage = Message.createSplitMessage(msg);
      if (splitMessage) {
        allMessages.push(splitMessage);
      }
    });
    //end
    if (this.initialPendingResult) {
      this.initialPendingResult.messages.forEach((msg) => {
        allMessages.push(msg);
        const splitMessage = Message.createSplitMessage(msg);
        if (splitMessage) {
          allMessages.push(splitMessage);
        }
      });
      pageState.event = this.initialPendingResult.event;
      this.initialPendingResult = undefined;
    }

    consoleLog(
      "messaging: TimelineNetworkDataSource: onResponse: allMessages: ",
      { allMessages }
    );

    // process sidebar messages and return list without sidebar messages
    const timelineInboxSidebars = dbMessages.ensureInboxTimelineSidebar(
      this.inboxId
    );
    const result = timelineInboxSidebars.insertSidebarMessage(allMessages);
    let conversationSidebar: ConversationSidebars | undefined;
    if (result.sidebarMessages.length > 0) {
      const stepExecutionMeta =
        result.sidebarMessages[result.sidebarMessages.length - 1].executionMeta;
      if (stepExecutionMeta) {
        conversationSidebar = timelineInboxSidebars.getSidebar(
          stepExecutionMeta.executionId
        );
      }
    }

    const table = dbMessages.ensureTimelineTable(this.inboxId);
    const insertUpdate = this.insertMessageToTable(
      table,
      drainRequest,
      result.messages
    );
    consoleLog(
      "messaging: TimelineNetworkDataSource: onResponse: allMessages: insertMessageToTable: ",
      {
        insertUpdate,
      }
    );
    callback(pageState.event, {
      messages: insertUpdate.insert,
      update: insertUpdate.update,
      sidebars: conversationSidebar,
    });
  }

  getPageStateInfo(): InboxStateInfo {
    consoleLog("messaging: getPageStateInfo of", this.inboxId.toString());
    return DbMessages.getInstance().ensureTimeLinePageState(this.inboxId);
  }

  parseResponse(payload: any): DrainResponse<Message> | undefined {
    consoleLog("messaging: TimelineNetworkDataSource: parseResponse");
    return SessionMessageDrainResponse.fromJSON(payload);
  }

  handleGetInboxMessages(
    payload: any,
    handleResponse: (payload: any, requestContext: SocketRequest) => void,
    request?: SocketRequest
  ) {}
}

export class SessionMessageDrainResponse implements DrainResponse<Message> {
  messageCount: number;
  constructor(
    readonly inboxId: KristaId,
    readonly offset: string,
    readonly messages: Message[]
  ) {
    this.messageCount = messages.length;
  }

  static fromJSON(json: any): SessionMessageDrainResponse | undefined {
    if (!json) {
      return undefined;
    }

    return new SessionMessageDrainResponse(
      KristaId.parse(json["inboxId"]),
      json["offset"],
      Message.fromJSONArray(json["messages"])
    );
  }
}

// TODO DELETE THIS CODE
export class TimelineMessageDrainResponse implements DrainResponse<Message> {
  constructor(
    readonly workspaceId: KristaId,
    readonly inboxId: KristaId,
    readonly offset: string,
    readonly pageSize: number,
    readonly messageCount: number,
    readonly sidebarMessageCount: number,
    readonly messages: Message[]
  ) {}

  static fromJSON(json: any): TimelineMessageDrainResponse | undefined {
    if (!json) {
      return undefined;
    }
    const newMessages = json["messages"]
      .map(convertToNewStructure) // platform to ksdk conversion
      .filter((m: any) => !!m);
    // consoleLog({ newMessages });
    return new TimelineMessageDrainResponse(
      KristaId.parse(json["workspaceId"]),
      KristaId.parse(json["inboxId"]),
      json["offset"],
      json["pageSize"],
      json["messageCount"],
      json["sidebarMessageCount"],
      Message.fromJSONArray(newMessages)
    );
  }
}

// TODO DELETE THIS CODE
export function convertToNewStructure(message: any) {
  const json: any = {};
  const attributes = message["attributes"];
  const stepExecutionMeta = message["stepExecutionMeta"];
  const targetAudience = message["targetAudience"];
  const form = attributes["form"];
  const authUrl = attributes["authUrl"];
  const formResponse = attributes["formResponse"];
  const mediaId = attributes["mediaId"];
  const mt = getMessageType(
    message["messageType"],
    stepExecutionMeta ? stepExecutionMeta["stepTypeId"] : "",
    form ? form["readOnly"] : false
  );
  if (!mt) {
    consoleLog("no type found for ", message["messageId"]);
    return undefined;
  }
  json["id"] = message["messageId"];
  json["sessionId"] = message["sessionId"];
  json["type"] = mt;
  json["inboxId"] = message["toInboxId"];
  if (message["fromAccount"]) {
    json["sender"] = {
      id: message["fromAccount"]["contactId"],
      name: message["fromAccount"]["name"],
    };
  }
  if (attributes["message"]) {
    json["message"] = getUserMessage(attributes["message"]);
  }
  if (formResponse) {
    json["submit"] = {
      type: formResponse["submitType"],
      value: formResponse["submitValue"],
    };
  }
  json["creationTime"] = message["creationTime"];
  if (attributes["paths"]) {
    json["paths"] = attributes["paths"];
  }
  if (attributes["sidebars"]) {
    json["sideConversations"] = attributes["sidebars"];
  }
  if (stepExecutionMeta) {
    json["executionMeta"] = {
      title: stepExecutionMeta["conversationTitle"],
      definitionId: stepExecutionMeta["conversationDefinitionId"],
      executionId: stepExecutionMeta["conversationId"],
      stepId: stepExecutionMeta["stepTypeId"],
      executionMode: stepExecutionMeta["executionMode"],
      testData: stepExecutionMeta["testData"],
      allowChat: stepExecutionMeta["allowChat"],
      flowId: stepExecutionMeta["branch"].join(", "),
    };
  }
  if (targetAudience) {
    json["targetAudience"] = {
      accountIds: targetAudience["accountIds"],
      roleIds: targetAudience["roleIds"],
      attributes: {},
    };
  }
  if (attributes["startTime"] && attributes["endTime"]) {
    json["timer"] = {
      start: attributes["startTime"],
      end: attributes["endTime"],
      action: "freeze",
    };
  }

  if (mediaId) {
    json["media"] = [
      {
        mimeType: getMimeType(attributes),
        title: attributes["fileName"],
        mediaId,
        attributes: {
          fileName: attributes["fileName"],
          length: attributes["length"],
          width: attributes["width"],
          height: attributes["height"],
          blurImage: attributes["blurImage"],
          recorded: attributes["recorded"],
          description: attributes["description"],
          imageURL: attributes["imageURL"],
          pageURL: attributes["pageURL"],
          extension: attributes["extension"],
        },
      },
    ];
  }
  if (form) {
    json["form"] = {
      pages: form["pages"].map((page: any) => {
        return {
          title: page["title"],
          fields: page["pageFields"].map((pageField: any) =>
            getFormPageField(
              pageField,
              formResponse ? formResponse["fieldValues"] : {}
            )
          ),
        };
      }),
    };
  }
  if (attributes["responder"]) {
    json["responder"] = {
      responder: attributes["responder"],
      currentResponseCount: attributes["currentResponseCount"],
      requiredResponseCount: attributes["requiredResponseCount"],
      targetMessageId: attributes["targetMessageId"],
      responseTime: attributes["responseTime"],
    };
  }
  if (authUrl) {
    json["authenticationMeta"] = {
      authUrl,
      systemName: attributes["systemName"],
    };
  }
  return json;
}

function getMimeType(attributes: any) {
  if (attributes["blurImage"]) {
    return attributes["width"] || attributes["height"] ? "Image" : "Video";
  }
  if (attributes["recorded"] !== undefined) {
    return "Audio";
  }
  if (attributes["imageUrl"] || attributes["pageUrl"]) {
    return "LinkPreview";
  }
  if (attributes["extension"]) {
    return "Document";
  }
}

function getMessageType(
  messageType: string,
  executionType?: string,
  readOnly?: boolean
) {
  if (messageType === "MT_2020") {
    // TODO how to detect formResponse step?
    return undefined;
  }
  if (messageType === "MT_4010") {
    return "MessageAsk";
  }
  if (messageType === "MT_6020") {
    return "system";
  }
  if (messageType === "MT_6010") {
    return "MessageResponseAck";
  }
  if (
    ["MT_1010", "MT_1020", "MT_1030", "MT_1040", "MT_1050", "MT_1060"].includes(
      messageType
    )
  ) {
    return "MessageInform";
  }
  if (executionType === "CST_1030" || executionType === "CST_1010") {
    return "MessageInform";
  }
  if (executionType === "CST_1040") {
    return readOnly ? "MessageAnswered" : "MessageAsk";
  }
  return undefined;
}

function getUserMessage(msg: any) {
  if (typeof msg === "object") {
    return msg["message"];
  } else if (typeof msg === "string") {
    return msg;
  }
  return "";
}

function getFieldValue(value: any, field: any) {
  if (field["fieldType"] === "com.krista.fields.Table") {
    const columns: any[] = field["attributes"]["meta"]["columns"] || [];
    const footerRows: any[] = field["attributes"]["meta"]["footerRows"] || [];
    const headerRows: any[] = field["attributes"]["meta"]["headerRows"] || [];
    const headers: any[] = value["headers"] || [];
    const footers: any[] = value["footers"] || [];
    const rows: any[] = value["rows"] || [];
    const deletedRows: any[] = value["deletedRows"] || [];
    return {
      headers: headerRows.map((row: any, rowIndex: number) => {
        const res: any = {};
        row.forEach((col: any) => {
          if (headers[rowIndex] && col["field"]) {
            if (headers[rowIndex][col["field"]["localId"]] !== undefined) {
              res[col["field"]["label"]] =
                headers[rowIndex][col["field"]["localId"]];
            } else if (headers[rowIndex][col["field"]["label"]] !== undefined) {
              res[col["field"]["label"]] =
                headers[rowIndex][col["field"]["label"]];
            }
          }
        });
        return res;
      }),
      footers: footerRows.map((row: any, rowIndex: number) => {
        const res: any = {};
        row.forEach((col: any) => {
          if (footers[rowIndex] && col["field"]) {
            if (footers[rowIndex][col["field"]["localId"]] !== undefined) {
              res[col["field"]["label"]] =
                footers[rowIndex][col["field"]["localId"]];
            } else if (footers[rowIndex][col["field"]["label"]] !== undefined) {
              res[col["field"]["label"]] =
                footers[rowIndex][col["field"]["label"]];
            }
          }
        });
        return res;
      }),
      rows: rows.map((row: any) => {
        const res: any = {};
        columns.forEach((col: any) => {
          if (row[col["field"]["localId"]] !== undefined) {
            res[col["field"]["label"]] = row[col["field"]["localId"]];
          } else if (row[col["field"]["label"]] !== undefined) {
            res[col["field"]["label"]] = row[col["field"]["label"]];
          }
        });
        return res;
      }),
      deletedRows: deletedRows.map((row: any) => {
        const res: any = {};
        columns.forEach((col: any) => {
          if (row[col["field"]["localId"]] !== undefined) {
            res[col["field"]["label"]] = row[col["field"]["localId"]];
          } else if (row[col["field"]["label"]] !== undefined) {
            res[col["field"]["label"]] = row[col["field"]["label"]];
          }
        });
        return res;
      }),
    };
  }
  return value;
}

function getEntityDefinition(entityDefinition: any) {
  return {
    ...entityDefinition,
    fields: entityDefinition["fields"].map((pageField: any) =>
      getFormPageField(pageField, {})
    ),
  };
}

function getFieldAttributes(attributes: any) {
  if (attributes["field"]) {
    attributes["field"] = getFormPageField(attributes["field"], {});
  }
  if (attributes["fields"]) {
    attributes["fields"] = attributes["fields"].map((pageField: any) =>
      getFormPageField(pageField, {})
    );
  }
  if (attributes["meta"]) {
    attributes["meta"] = getTableMeta(attributes["meta"]);
  }
  if (attributes["entityDefinition"]) {
    attributes["entityDefinition"] = getEntityDefinition(
      attributes["entityDefinition"]
    );
  }
  return attributes;
}

function getFormPageField(pageField: any, values: any) {
  const field = pageField["field"];
  let value;
  const json: any = {};

  if (field) {
    value = values[pageField["localId"]];
    if (value !== undefined) {
      json["value"] = getFieldValue(value, field);
    }
    json["name"] = pageField["label"] || pageField["fieldName"];
    json["fieldType"] = field["fieldType"];
    json["attributeValues"] = getFieldAttributes(field["attributes"]);
    if (
      field["fieldType"] === "com.krista.fields.Entity" &&
      field["attributes"]["entityTypeDomain"]
    ) {
      json["attributeValues"]["entityDefinition"] = {
        name: field["attributes"]["entityTypeDomain"]["entityName"],
        entityType: field["attributes"]["entityTypeDomain"],
        fields: (field["attributes"]["filters"] || []).map((pageField: any) => {
          const f = getFormPageField(pageField, {});
          f["options"] = {
            ...f["options"],
            searchable: {
              fieldType: "Boolean",
              value: true,
            },
            includeInSummary: {
              fieldType: "Boolean",
              value: true,
            },
          };
          return f;
        }),
      };
    }
    json["options"] = field["options"];
    if (pageField["readOnly"]) {
      json["options"]["readOnly"] = {
        value: true,
        fieldType: "Boolean",
      };
    }
  } else {
    value = values[pageField["name"]];
    json["name"] = pageField["name"];
    json["fieldType"] = pageField["fieldType"];
    json["attributeValues"] = getFieldAttributes(pageField["attributes"]);
    if (
      pageField["fieldType"] === "com.krista.fields.Entity" &&
      pageField["attributes"]["entityTypeDomain"]
    ) {
      json["attributeValues"]["entityDefinition"] = {
        name: pageField["attributes"]["entityTypeDomain"]["entityName"],
        entityType: pageField["attributes"]["entityTypeDomain"],
        fields: pageField["attributes"]["filters"].map((pageField: any) => {
          const f = getFormPageField(pageField, {});
          f["options"] = {
            ...f["options"],
            searchable: {
              fieldType: "Boolean",
              value: true,
            },
            includeInSummary: {
              fieldType: "Boolean",
              value: true,
            },
          };
          return f;
        }),
      };
    }
    json["options"] = pageField["options"];
    if (value !== undefined) {
      json["value"] = getFieldValue(value, field);
    }
  }
  if (pageField["displayLabel"] || pageField["displayName"]) {
    json["displayLabel"] =
      pageField["displayLabel"] || pageField["displayName"];
  }
  return json;
}

function getTableMeta(meta: any) {
  const columns = meta["columns"];
  const entity = meta["entity"];
  const footerRows = meta["footerRows"];
  const headerRows = meta["headerRows"];
  return {
    ...meta,
    columns: columns.map((col: any) => {
      return {
        ...col,
        field: getFormPageField(col["field"], {}),
      };
    }),
    entity: getFormPageField(entity, {}),
    footerRows: footerRows.map((row: any) => {
      return row.map((col: any) => {
        if (col["field"]) {
          return getFormPageField(col["field"], {});
        }
        return null;
      });
    }),
    headerRows: headerRows.map((row: any) => {
      return row.map((col: any) => {
        if (col["field"]) {
          return getFormPageField(col["field"], {});
        }
        return null;
      });
    }),
  };
}
