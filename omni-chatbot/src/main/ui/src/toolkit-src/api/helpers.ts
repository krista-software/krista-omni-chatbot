import axios from "axios";
import i18next from "i18next";
import { AjaxRequest } from "./types";
import { ToolkitConfig } from "../ToolkitConfig";
import {PrefStorage} from "../../chatbot-src/modules/storage/PrefStorage.ts";

declare global {
  interface Window {
    Authenticator: any;
  }
}

export const generateApiUrl = (apiKey: string, data: any): string => {
  const matches = apiKey.match(/<[a-zA-Z]+?>/g);
  let string = apiKey;
  if (matches) {
    matches.forEach((replacePattern) => {
      const dataKey = replacePattern.replace(/<|>/g, "");
      string = string.replace(replacePattern, data[dataKey]);
    });
  }

  return string;
};

const generateFinalAPIUrl = (url: string) => {
  let string = url;
  if (
    !["http://", "https://"].includes(string.substring(0, 8)) &&
    window.location.hostname.indexOf("extension.") === 0 &&
    string.indexOf("/") === 0 && !url.includes("/media/workspaces")
  ) {
    string = `${window.location.origin.replace("extension.", "")}${string}`;
  }
  return string;
};

export const createAjaxRequest = ({ url, data = {}, options }: AjaxRequest) => {
  const defaultHeaders = {
    Accept: "application/json;charset=UTF-8",
    "Content-Type": "application/json;charset=UTF-8",
    "Chatbot-Session-Id": PrefStorage.getClientSessionId()
  };

  const defaultConfig: any = {
    method: options.method || "GET",
    headers: defaultHeaders,
    timeout: options.timeout || 180000,
  };

  let xHeaders = {};
  const clientSessionId =
    ToolkitConfig.getInstance().getConfig()?.clientSessionId;
  const config = {
    ...defaultConfig,
    url: generateFinalAPIUrl(url),
    ...options,
    headers: { ...defaultHeaders, ...options?.headers },
  };
  if (clientSessionId) {
    if (config.method === "GET" || url.indexOf("/api/rpc/") !== 0) {
      if (url.indexOf("/api/rpc/") === 0) {
        xHeaders = {
          "X-Krista-Context": encodeURIComponent(
            JSON.stringify({ clientSessionId })
          ),
        };
      } else if (window.Authenticator) {
        xHeaders = window.Authenticator.decorateRequest();
      }
    }
  }

  config.headers = { ...config.headers, ...xHeaders };

  if (config.method === "GET" && Object.keys(data).length) {
    config.params = data;
  } else {
    config.data = data;
  }

  return axios(config)
    .then((response) => {
      const { data } = response;
      const { payload } = data;
      if (data.isError || (payload && payload.validationErrors)) {
        const errorMessage = getValidationErrorMessage(
          payload.validationErrors
        );

        return Promise.reject(new Error(errorMessage));
      }
      return response;
    })
    .catch((error) => {
      return Promise.reject(error);
    });
};

function getValidationErrorMessage(validationErrors: any[]): string {
  if (validationErrors && Array.isArray(validationErrors)) {
    const errorMessages: Array<string> = new Array<string>();
    validationErrors.forEach((error) => {
      const errorMsg = error["errMessage"];
      if (errorMsg) {
        errorMessages.push(errorMsg);
      }
    });
    return errorMessages.length > 0
      ? errorMessages.join(" | ")
      : i18next.t("krista.general.defaultErrorMessage");
  }
  return "";
}
