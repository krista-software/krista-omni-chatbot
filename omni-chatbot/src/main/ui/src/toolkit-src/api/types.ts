import { CancelToken } from "axios";
import { EntitySearchResult } from "../services/fields-handler/renderers/react/entity/EntitySearchResult";

export interface AjaxOptions {
  cancelToken?: CancelToken;
  method?: string;
  headers?: any;
  timeout?: number;
}

export interface AjaxRequest {
  url: string;
  data?: any;
  options: AjaxOptions;
}

export interface EntitySearchSuccessProps {
  status: "success";
  data: EntitySearchResult;
}

export interface EntitySearchErrorProps {
  status: "error";
}

export interface EntitySearchAuthenticationProps {
  status: "authentication";
  data: {
    invokerName: string;
    authUrl: string;
  };
}

export type EntitySearchResultProps =
  | EntitySearchSuccessProps
  | EntitySearchErrorProps
  | EntitySearchAuthenticationProps;
