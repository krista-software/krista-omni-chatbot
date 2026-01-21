import { AxiosResponse } from "axios";
import {
  IMessageDataSource,
  InboxCallbackResult,
  ResultEvent,
} from "./IMessageDataSource";
import { ISocketSignalListener } from "../socket/ISocketSignalListener";
import { KSDKIMessage as IMessage } from "../message/KSDKIMessage";
import { KristaId } from "../../../common/KristaId";
import { SocketRequest } from "../socket/SocketRequest";
import { consoleLog, newGuid } from "../../../common/utils";
import { InboxStateInfo } from "./DbMessages";
import { MessageTable } from "./MessageTable";
import {
  GetMessagesParams,
  GetExecutionsParams,
} from "../../../client-api/protocols/rest/types";
import { ClientAPIClient } from "../../../client-api/ClientAPIClient";

export abstract class MessageNetworkDataSource<T extends IMessage>
  implements IMessageDataSource<T>, ISocketSignalListener
{
  private static REQUEST_DELAY = 1500;
  private static EMPTY_OFFSET_KEY = "initialDrain";
  public readonly objectId = newGuid();

  protected _type = "messages";
  private readonly pendingRequestMap: Map<string, PendingRequest<T>> =
    new Map();
  private readonly pendingOffsetIdRequestSet: Set<string> = new Set();

  protected constructor(
    readonly workspaceId: KristaId,
    readonly inboxId: KristaId
  ) {}

  abstract getPageStateInfo(): InboxStateInfo;

  abstract parseResponse(payload: any): DrainResponse<T> | undefined;

  abstract getDrainRequestPayload(
    offsetId: string | undefined,
    before: number,
    after: number,
    inclusive?: boolean
  ): {
    payload: GetMessagesParams | GetExecutionsParams;
    updatedRequest: DrainRequest;
  };

  abstract onResponse(
    drainRequest: DrainRequest,
    payload: DrainResponse<T> | undefined,
    pageState: PageState,
    callback: InboxCallbackResult<T>
  ): void;

  getMessages(
    offsetId: string | undefined,
    before: number,
    after: number,
    callback: InboxCallbackResult<T>,
    inclusive: boolean = false,
    forceSync: boolean = false
  ): void {
    consoleLog("messaging: MessageNetworkDataSource: getMessages:", {
      offsetId,
      before,
      after,
      inclusive,
      forceSync,
    });
    const pageState = this.getPageStateInfo();
    consoleLog("messaging: MessageNetworkDataSource: getMessages: pageState:", {
      pageState_atTop: pageState._atTop,
      pageState_atBottom: pageState._atBottom,
    });
    if (!forceSync && pageState) {
      if (after > 0 && pageState._atTop) {
        consoleLog("messaging: MessageNetworkDataSource: Already at Top");
        // consoleLog("MsgSync", "Already at Top");
        callback(ResultEvent.Reach_Top, { messages: [] });
        return;
      } else if (before > 0 && pageState._atBottom) {
        consoleLog("messaging: MessageNetworkDataSource: Already at Bottom");
        // consoleLog("MsgSync", "Already at Bottom");
        callback(ResultEvent.Reach_Bottom, { messages: [] });
        return;
      }
    }

    const requestKey = offsetId
      ? offsetId.toString()
      : MessageNetworkDataSource.EMPTY_OFFSET_KEY;
    if (this.pendingOffsetIdRequestSet.has(requestKey)) {
      const request = this.pendingRequestMap.get(requestKey);
      if (
        request &&
        new Date().valueOf() - request.requestContext.requestTime <
          MessageNetworkDataSource.REQUEST_DELAY
      ) {
        consoleLog(
          "messaging: MessageNetworkDataSource: OtherRequestInProgress"
        );
        callback(ResultEvent.OtherRequestInProgress, { messages: [] });
        return;
      }
    }
    consoleLog(
      "messaging: MessageNetworkDataSource: preparing request payload"
    );
    this.pendingOffsetIdRequestSet.add(requestKey);
    const requestContext = new SocketRequest(KristaId.parse(requestKey));
    const drainPayload = this.getDrainRequestPayload(
      offsetId,
      before,
      after,
      inclusive
    );

    this.pendingRequestMap.set(requestContext.transactionId.toString(), {
      requestContext: requestContext,
      drainRequest: drainPayload.updatedRequest,
      callback: callback,
    });
    consoleLog("messaging: MessageNetworkDataSource: request payload: ", {
      payload: drainPayload.payload,
      requestContext,
    });

    const clientApiInstance = ClientAPIClient.getInstance();
    let getApiCall: Promise<AxiosResponse<any>>;
    if (this._type === "executions") {
      getApiCall = clientApiInstance.getConversationExecutions(
        drainPayload.payload as GetExecutionsParams
      );
    } else {
      getApiCall = clientApiInstance.getMessages(
        drainPayload.payload as GetMessagesParams
      );
    }
    getApiCall
      .then((response) => {
        consoleLog("messaging: MessageNetworkDataSource: response: ", {
          messages: response.data,
          inboxId: this.inboxId,
          offset: drainPayload.updatedRequest.offsetId,
        });
        this.handleResponse(
          {
            messages: response.data,
            inboxId: this.inboxId,
            offset: drainPayload.updatedRequest.offsetId,
          },
          requestContext
        );
      })
      .catch((err) => console.error(err)); // TODO handle error cases
    // console.log({
    //   socketRequestApi: this.socketRequestApi,
    //   payload: drainPayload.payload,
    //   requestContext,
    // });
  }

  private updatePageStateInfo(
    iMessages: T[],
    drainRequest: DrainRequest
  ): PageState {
    consoleLog("messaging: TimelineNetworkDataSource: updatePageStateInfo: ", {
      drainRequest,
    });
    let resultEvent = ResultEvent.Success;
    const msgCount = iMessages.length;
    let _atTop = undefined;
    let _atBottom = undefined;
    if (!drainRequest.offsetId) {
      _atBottom = msgCount < drainRequest.before;
      _atTop = msgCount < drainRequest.after;
      // if very first call result is empty we have no unread message
      // We reach inbox top.
      if (_atTop) {
        resultEvent = ResultEvent.Reach_Top;
      }
      consoleLog(
        "messaging: TimelineNetworkDataSource: updatePageStateInfo: no unread messages scenario: ",
        {
          _atBottom,
          _atTop,
        }
      );
    } else if (
      drainRequest.offsetId &&
      drainRequest.after > 0 &&
      drainRequest.before > 0
    ) {
      const offsetIndex = iMessages.findIndex(
        (msg) => msg.getId() === drainRequest.offsetId
      );
      _atBottom = offsetIndex < drainRequest.before;
      _atTop = msgCount - (offsetIndex + 1) < drainRequest.after;
      if (_atTop) {
        resultEvent = ResultEvent.Reach_Top;
      }
      consoleLog(
        "messaging: TimelineNetworkDataSource: updatePageStateInfo: offsetId && after > 0 && before > 0 ",
        {
          _atBottom,
          _atTop,
        }
      );
    } else {
      if (drainRequest.before > 0 && msgCount < drainRequest.before) {
        _atBottom = true;
        resultEvent = ResultEvent.Reach_Bottom;
      }

      if (drainRequest.after > 0 && msgCount < drainRequest.after) {
        _atTop = true;
        resultEvent = ResultEvent.Reach_Top;
      }
      consoleLog(
        "messaging: TimelineNetworkDataSource: updatePageStateInfo: ",
        {
          _atBottom,
          _atTop,
        }
      );
    }

    const pageStateInfo = this.getPageStateInfo();
    if (_atBottom) {
      pageStateInfo._atBottom = _atBottom;
    }
    if (_atTop) {
      pageStateInfo._atTop = _atTop;
    }
    consoleLog("messaging: TimelineNetworkDataSource: pageStateInfo: ", {
      _atBottom: pageStateInfo._atBottom,
      _atTop: pageStateInfo._atTop,
    });
    // consoleLog("MessageNetworkDataSource - updatePageStateInfo",
    //   "newTop: " + _atTop, "newBottom: " + _atBottom);
    return {
      event: resultEvent,
      isNewTop: _atTop || false,
      isNewBottom: _atBottom || false,
    };
  }

  protected insertMessageToTable(
    messageTable: MessageTable<T>,
    drainRequest: DrainRequest,
    messages: T[]
  ): { insert: T[]; update: T[] } {
    if (messages.length === 0) {
      return { insert: [], update: [] };
    }
    // this condition true for drain data with deeplink
    // and fetching data above and below offset
    if (!drainRequest.offsetId) {
      return messageTable.insertAtBottom(messages);
    } else if (drainRequest.after > 0) {
      return messageTable.insertAtBottom(messages);
    } else if (drainRequest.before > 0) {
      return messageTable.insertAtTop(messages);
    }
    return { insert: [], update: [] };
  }

  onSignal(api: string, payload: any, requestContext: SocketRequest): void {
    this.handleResponse(payload, requestContext);
  }

  handleResponse(payload: any, requestContext: SocketRequest) {
    if (
      requestContext &&
      payload &&
      this.inboxId.equals(KristaId.unwrapInboxId(payload.inboxId))
    ) {
      consoleLog("messaging: MessageNetworkDataSource: handleResponse");
      const requestId = requestContext?.transactionId.toString();
      const pendingRequest = this.pendingRequestMap.get(requestId);
      this.pendingRequestMap.delete(requestId);
      if (pendingRequest) {
        const transactionId = pendingRequest.requestContext.transactionId;
        if (transactionId.equals(requestContext?.transactionId)) {
          const drainRequest = pendingRequest.drainRequest;
          this.pendingOffsetIdRequestSet.delete(
            requestContext.transactionId.toString()
          );
          const drainResponse = this.parseResponse(payload);
          const pageState = this.updatePageStateInfo(
            drainResponse?.messages || [],
            drainRequest
          );
          consoleLog(
            "messaging: MessageNetworkDataSource: handleResponse: pageState updated: ",
            {
              pageState_isNewTop: pageState.isNewTop,
              pageState_isNewBottom: pageState.isNewBottom,
            }
          );
          this.onResponse(
            drainRequest,
            drainResponse,
            pageState,
            pendingRequest.callback
          );
        }
      }
    }
  }

  close() {
    this.pendingRequestMap.clear();
    this.pendingOffsetIdRequestSet.clear();
  }
}

export interface PendingRequest<T extends IMessage> {
  requestContext: SocketRequest;
  drainRequest: DrainRequest;
  callback: InboxCallbackResult<T>;
}

export interface DrainRequest {
  offsetId?: string;
  before: number;
  after: number;
}

export interface DrainResponse<T extends IMessage> {
  messages: T[];
  inboxId: KristaId;
}

export interface PageState {
  event: ResultEvent;
  isNewTop: boolean;
  isNewBottom: boolean;
}
