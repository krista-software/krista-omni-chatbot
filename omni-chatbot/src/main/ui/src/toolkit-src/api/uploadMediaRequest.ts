import axios, { CancelTokenSource } from "axios";
import { createAjaxRequest } from "./helpers";

interface MediaProps {
  workspaceId: string | null;
  file: File;
  scope: string,
  md5Checksum: string,
  removeAfter?: number
}

// TODO api suffix constant

export const uploadMediaRequest = (
  data: MediaProps
): { cancelToken: CancelTokenSource; axiosPromise: Promise<any> } => {
const cancelToken = axios.CancelToken.source();
const formData = new FormData();
formData.append('file', data.file);
formData.append('scope', data.scope);
formData.append('checksum', data.md5Checksum);

const axiosPromise = createAjaxRequest({
  url: `/media/workspaces/${data.workspaceId}`,
  data: formData,
  options: {
    cancelToken: cancelToken.token,
    method: "PUT",
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300000,
  },
})
  .then((response: { data: any; }) => {
    return { response, data: { file: data.file, mediaId: response.data } };
  })
  .catch((error: any) => {
    return Promise.reject(error);
  });
return { cancelToken, axiosPromise };
};
