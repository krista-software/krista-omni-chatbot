/**
 * Shared media-download URL builder.
 *
 * Consolidates logic that was duplicated across html-sanitizer.util,
 * CameraFieldComponent and FileFieldComponent: read the client session id
 * from localStorage and build the platform media download URL.
 */

/**
 * Reads the client session id straight from localStorage.
 *
 * No legacy 'pref/device/clientSessionId' fallback: that React-era key held a
 * client-generated 'device_...' label, not a server session token, so the
 * current server could never resolve it — the fallback only ever produced a
 * rejected request.
 *
 * Standalone function (not on StorageService) because one caller — the
 * sanitize-html img transform — runs outside Angular DI.
 */
export function getStoredClientSessionId(): string {
  let clientSessionId = localStorage.getItem('krista_chatbot_clientSessionId');
  // Angular's StorageService stores values JSON-stringified — strip the quotes
  if (clientSessionId && clientSessionId.startsWith('"')) {
    try {
      clientSessionId = JSON.parse(clientSessionId);
    } catch {
      // Keep as is if parsing fails
    }
  }
  return clientSessionId || '';
}

/**
 * Builds the media download URL used across the app:
 * {origin}/media/workspaces/{workspaceId}/{mediaId}?clientSessionId=...
 * Returns '' when either id is missing.
 */
export function createMediaUrlDownload(workspaceId: string, mediaId: string): string {
  if (!workspaceId || !mediaId) {
    return '';
  }
  return `${window.location.origin}/media/workspaces/${workspaceId}/${mediaId}?clientSessionId=${getStoredClientSessionId()}`;
}
