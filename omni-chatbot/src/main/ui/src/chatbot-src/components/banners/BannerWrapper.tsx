import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { KSDKIMessage as IMessage } from "../../../toolkit-src";
import { MessageBanner } from "./MessageBanner";

export const BannerWrapper = ({
  index,
  messages,
  message,
  firstItemIndex,
  unreadMessageId = "",
}: {
  index: number;
  messages: Array<IMessage>;
  message: IMessage;
  unreadMessageId: string;
  firstItemIndex: number;
}) => {
  const { t } = useTranslation();
  const lastMessage = messages[index - firstItemIndex - 1];
  const isSentOnDifferentDay =
    lastMessage &&
    !dayjs(message?.getCreationTime()).isSame(
      dayjs(lastMessage?.getCreationTime()),
      "day"
    );

  const showDate = index === firstItemIndex || isSentOnDifferentDay;
  const showUnread = message.getId() === unreadMessageId;

  return showDate || showUnread ? (
    <MessageBanner>
      {showDate && dayjs(message?.getCreationTime()).format("ddd, D MMM YYYY")}
      {showUnread && (
        <span style={{ marginLeft: "1rem" }}>{t("banner.unread")}</span>
      )}
    </MessageBanner>
  ) : null;
};
