import { AxiosResponse } from "axios";
import { createAjaxRequest } from "../../../api/helpers";
import { GetExecutionsParams, GetMessagesParams } from "./types";

export class RESTHandler {
  private static instance: RESTHandler;

  private constructor() {}

  /**
   * A static method for getting a singleton instance of RestHandler
   * @static
   * @returns {RESTHandler} A singleton instance of RestHandler
   */
  static getInstance(): RESTHandler {
    if (!this.instance) {
      this.instance = new RESTHandler();
    }
    return this.instance;
  }

  // authHandler(): Promise<AxiosResponse<any>> {
  //   return axios.get("/websocket/auth_code");
  // }

  getMessages(params: GetMessagesParams): Promise<AxiosResponse<any>> {
    return createAjaxRequest({
      url: `chatbot/inboxes/${params.inboxId}/messages`,
      options: {},
      data: params,
    });
  }

  getConversationExecutions(
    params: GetExecutionsParams
  ): Promise<AxiosResponse<any>> {
    return createAjaxRequest({
      url: `inboxes/${params.inboxId}/executions`,
      options: {},
      data: params,
    });
  }
}
