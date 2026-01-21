import {PrefStorage} from "../../../../chatbot-src/modules/storage/PrefStorage.ts";

export function createMediaUrlDownload(workspaceId:string, mediaId: string) {
  return `${window.location.origin}/media/workspaces/${workspaceId}/${mediaId}?clientSessionId=${PrefStorage.getClientSessionId()}`;
}
