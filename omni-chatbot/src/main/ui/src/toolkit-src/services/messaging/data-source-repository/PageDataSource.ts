import { KSDKIMessage as IMessage } from "../message/KSDKIMessage";
import { IMessageDataSource, InboxCallbackResult } from "./IMessageDataSource";
import { consoleLog, newGuid } from "../../../common/utils";

export class PageDataSource<T extends IMessage> {
  public readonly objectId = newGuid();
  private _bottomOffsetMessageId: string = "";
  private _topOffsetMessageId: string = "";

  constructor(
    private dataSource: IMessageDataSource<T>,
    private readonly pageSize: number
  ) {
    // consoleLog("MsgSync", "PageDataSource - constructor" + this.objectId);
  }

  nextPage(callback: InboxCallbackResult<T>, pageSize?: number): void {
    consoleLog(
      "messaging: PageDataSource: nextPage: topOffsetMessageId: ",
      this._topOffsetMessageId
    );
    const resultCallBack: InboxCallbackResult<T> = (event, result) => {
      consoleLog("messaging: callback 2: resultCallBack: ", { event, result });
      let messages = result.messages;
      if (messages.length > 0) {
        this._topOffsetMessageId = messages[messages.length - 1].getId();
        if (this._bottomOffsetMessageId === "") {
          this._bottomOffsetMessageId = messages[0].getId();
        }
      }
      callback(event, result);
    };
    this.dataSource.getMessages(
      this._topOffsetMessageId,
      0,
      pageSize ? pageSize : this.pageSize,
      resultCallBack
    );
  }

  prevPage(callback: InboxCallbackResult<T>): void {
    const resultCallBack: InboxCallbackResult<T> = (event, result) => {
      let messages = result.messages;
      if (messages.length > 0) {
        this._bottomOffsetMessageId = messages[0].getId();
        if (this._topOffsetMessageId === "") {
          this._topOffsetMessageId = messages[messages.length - 1].getId();
        }
      }
      callback(event, result);
    };
    this.dataSource.getMessages(
      this._bottomOffsetMessageId,
      this.pageSize,
      0,
      resultCallBack
    );
  }

  resetPage() {
    this._bottomOffsetMessageId = "";
    this._bottomOffsetMessageId = "";
  }

  setBottomOffsetIfNull(bottomOffset: string) {
    if (!this._bottomOffsetMessageId || this._bottomOffsetMessageId === "") {
      this._bottomOffsetMessageId = bottomOffset;
    }
  }

  setBottomOffset(bottomOffset: string) {
    this._bottomOffsetMessageId = bottomOffset;
  }

  setTopOffset(topOffset: string) {
    this._topOffsetMessageId = topOffset;
  }

  close() {
    this.resetPage();
    this.dataSource.close();
  }
}
