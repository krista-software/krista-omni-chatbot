import axios, { CancelTokenSource } from "axios";
import { useRecoilState } from "recoil";
import { createAjaxRequest, generateApiUrl } from "../../../toolkit-src";
import { configAtom } from "../../atoms";
import { GET_CONFIGURATION } from "./apiURLs";

export const useGetConfiguration = () => {
  const [config, setConfiguration] = useRecoilState(configAtom);
  const ajaxCall = (): CancelTokenSource => {
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();

    createAjaxRequest({
      url: generateApiUrl(GET_CONFIGURATION, {}),
      options: {
        cancelToken: source.token,
      },
    })
      .then((response) => {
        const _config = {
          ...response?.data,
          _apiStatus_: "success",
          _error_: null,
        };
        setConfiguration(_config);
      })
      .catch((error) => {
        const _config = {
          ...config,
          _apiStatus_: "error",
          _error_: error?.response?.data,
        };
        setConfiguration(_config);
      });

    return source;
  };
  return ajaxCall;
};
