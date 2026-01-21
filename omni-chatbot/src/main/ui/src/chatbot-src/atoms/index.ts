import { atom, selector } from "recoil";
import { Theme } from "@mui/material";
import { WorkspaceContact } from "../modules/workspace/contact/WorkspaceContact";
import { Color } from "../../toolkit-src";

export type CustomThemeColors = {
  brandColor: Color;
  textColor: Color;
  dividerColor: Color;
  fontFamily?: string; // Custom font family
  fontImportUrl?: string; // Google Fonts or custom font URL
};

export type ChatbotConfig = {
  workspaceId: string;
  nodeName: string;
  kristaAccountId: string;
  icon?: string;
  isMultilingualEnabled: boolean;
  config: {
    botName?: string;
    botSubTitle?: string;
    TnC?: string;
    TnCLabel?: string;
    outlineColor?: string;
    outlineWidth?: string;
    logo?: string;
    canChangeLanguage?: string;
    botNamePosition?: string; // "center", "left", "right"
    theme?: CustomThemeColors;
    isFullSize?: boolean;
    restartOnRefresh?: boolean;
    hideSendMessage?: boolean;
  };
  _apiStatus_?: string;
  _error_?: any;
};

//this needs to be defined
export const configAtom = atom<ChatbotConfig>({
  key: "chatbotConfig",
  default: {
    workspaceId: "",
    kristaAccountId: "",
    nodeName: "",
    isMultilingualEnabled: false,
    config: {},
  },
});

export const outgoingBubbleThemeAtom = atom<Theme | null>({
  key: "outgoingBubbleThemeAtom",
  default: null,
});

export const isRetryConfigAtom = atom({
  key: "isRetryConfigState",
  default: false,
});

export const isLoggedInAtom = atom({
  key: "isLoggedInState",
  default: false,
});

export const isWsLoggedInAtom = atom({
  key: "isWsLoggedInState",
  default: false,
});

export const userSnapshotAtom = atom({
  key: "userSnapshotState",
  default: {},
});

export const userDataAtom = atom<any>({
  key: "userDataState",
  default: null,
});

export const queryParamsOfHostedSite = atom<any>({
  key: "queryParamsOfHostedSite",
  default: {},
});

export const sessionIdAtom = atom({
  key: "sessionIdState",
  default: "",
});

export const workspaceContactsAtom = atom<{
  contactMap: Map<string, WorkspaceContact>;
  invalidContacts: Set<string>;
}>({
  key: "contactsAtom",
  default: {
    contactMap: new Map<string, WorkspaceContact>(),
    invalidContacts: new Set<string>(),
  },
});

export const notificationBadgeCountSelector = selector({
  key: "notificationBadgeCountSelector",
  get: ({ get }) => {
    const userSnapshot: any = get(userSnapshotAtom);

    let count = 0;
    for (let key in userSnapshot?.notificationBadge) {
      if (["needsInput", "unread"].includes(key)) {
        count += userSnapshot.notificationBadge[key];
      }
    }
    return count;
  },
});

export const hideFooterAtom = atom<boolean>({
  key: "hideFooterState",
  default: false,
});

export const isTypingAtom = atom<boolean>({
  key: "isTypingState",
  default: false,
});
