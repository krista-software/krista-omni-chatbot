import axios, { CancelTokenSource } from "axios";
import { EntitySearchDto } from "../services/fields-handler/renderers/react/entity/EntitySearchDto";
import { EntitySearchResult } from "../services/fields-handler/renderers/react/entity/EntitySearchResult";
import {
  EntitySearchAuthenticationProps,
  EntitySearchResultProps,
  EntitySearchSuccessProps,
} from "./types";
import { createAjaxRequest } from "./helpers";

export const loadEntities = (data: {
  payload: EntitySearchDto;
  timeout?: number;
}): {
  cancelToken: CancelTokenSource;
  axiosPromise: Promise<EntitySearchResultProps>;
} => {
  const cancelTokenSource = axios.CancelToken.source();
  const axiosPromise = createAjaxRequest({
    url: "chatbot/entities/search",
    options: {
      cancelToken: cancelTokenSource.token,
      method: "POST",
    },
    data: data.payload.toJSON(),
  })
    .then((response) => {
      const authentication = response.data["authentication"];
      if (authentication) {
        return {
          status: "authentication",
          data: {
            invokerName: authentication["invokerName"],
            authUrl: authentication["authUrl"],
          },
        } as EntitySearchAuthenticationProps;
      }
      return {
        status: "success",
        data: EntitySearchResult.fromJSON(response.data),
      } as EntitySearchSuccessProps;
    })
    .catch((error) => {
      let errorMessage = "Something went wrong. Try again later.";
      if (error.response && error.response.data) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = error.response.data;
      } else if (error.message) {
        // Something happened in setting up the request that triggered an Error
        errorMessage = error.message;
      }
      return Promise.reject(errorMessage);
    });
  return { cancelToken: cancelTokenSource, axiosPromise };
};
