import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import { configAtom } from "../atoms";
import {createMediaUrlDownload, Icon} from "../../toolkit-src";
import KristaIcon from "../assets/images/krista-icon.svg";

export function useChatbotIcon(): string {
  const chatbotConfig = useRecoilValue(configAtom);

  const icon = useMemo(() => {
    let _icon = KristaIcon;

    if (chatbotConfig.config?.logo) {
      _icon = chatbotConfig.config.logo;
    } else if (chatbotConfig.icon) {
      const i = Icon.create(chatbotConfig.icon);
      if (i.mediaId) {
        _icon = createMediaUrlDownload(chatbotConfig.workspaceId, i.mediaId);
      }
    }

    return _icon;
  }, [chatbotConfig]);

  return icon;
}
