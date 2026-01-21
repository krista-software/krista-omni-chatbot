import React, {useEffect, useMemo, useRef, useState} from "react";
import {Virtuoso} from "react-virtuoso";
import {Box} from "@mui/material";
import {useRecoilValue, useSetRecoilState} from "recoil";
import {
  KSDKIMessage as IMessage,
  InboxCallbackResult,
  KristaId,
  KSDKMessage as Message,
  MessageRepository,
  MessageType,
  ResultEvent,
  SyncMessageService,
} from "../../../toolkit-src";
import {MessageBubble} from "./MessageBubble";
import {ListLoader} from "./ListLoader";
import {configAtom, hideFooterAtom, isTypingAtom, sessionIdAtom} from "../../atoms";
import {BannerWrapper} from "../banners/BannerWrapper";
import {SystemEventMessage} from "../message/SystemEventMessage";
import SvgIcon from "@mui/material/SvgIcon";
import {DotsStyleLoading} from "./LoadingSkeleton.tsx";
import {
  NotificationCallbackResult
} from "../../../toolkit-src/services/messaging/data-source-repository/IMessageDataSource.ts";
import NewMessagesBtn from "./NewMessagesBtn.tsx";

const getLastReadMessage = (messages: Array<IMessage>):
  { id: string; index: number } | null => {
  if (!messages.length) {
    return null;
  }
  let lastIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.isRead || !messages[i]?.isIncoming) {
      return lastIndex === -1
        ? null
        : {id: messages[lastIndex].getId(), index: lastIndex};
    }
    lastIndex = i;
  }
  return {id: messages[0]?.getId(), index: 0};
};

const detectBottom = (e: any, prevValue: boolean, cb: any) => {
  const {scrollTop, scrollHeight, offsetHeight} = e.target;
  const scrollAtBottom = scrollHeight - (scrollTop + offsetHeight) < 100;
  if (scrollAtBottom !== prevValue) {
    cb(scrollAtBottom);
  }
};

export function TimelineView() {
  const sessionId = useRecoilValue(sessionIdAtom);
  const setHideFooter = useSetRecoilState(hideFooterAtom);
  const [messages, setMessages] = useState<Array<Message>>([]);
  const [newIncomingMessages, setNewIncomingMessages] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [preventAutoScroll, setPreventAutoScroll] = useState(false);
  const [forceScrollToBottom, setForceScrollToBottom] = useState(false);
  const chatbotConfig = useRecoilValue(configAtom);
  const isTyping = useRecoilValue(isTypingAtom);
  const setIsTyping = useSetRecoilState(isTypingAtom);
  const hideFooter = useRecoilValue(hideFooterAtom);

  useEffect(() => {
    // Reset typing state when a component mounts
    setIsTyping(false);

    const stateCallback: NotificationCallbackResult = (newState) => {
      setIsTyping(newState);
    };
    SyncMessageService.getInstance().registerStateNotification(stateCallback);

  }, [setIsTyping]);

  const virtuoso = useRef(null);
  const pageDataSource = useMemo(() => {
    const messageRepository = MessageRepository.getInstance();

    if (!chatbotConfig.workspaceId || !sessionId) {
      return;
    }
    const dataSource = messageRepository.getTimelinePageDataSource(
      KristaId.parse(chatbotConfig.workspaceId),
      KristaId.parse(sessionId)
    );
    return dataSource;
  }, [sessionId, chatbotConfig.workspaceId]);

  const isMounted = useRef(true);
  const [firstItemIndex, setFirstItemIndex] = useState(10000);
  const [unreadMessage, setUnreadMessage] = useState({id: "", index: -1});
  const [fetchingPrevMessages, setFetchingPrevMessages] = useState(false);
  const [fetchingNextMessages, setFetchingNextMessages] = useState(true);
  const [isWelcomeMessage, setIsWelcomeMessage] = useState(false);

  const nextPageCallback: InboxCallbackResult<Message> = (resultEvent, result) => {
    if (!isMounted.current) return;

    setFetchingNextMessages(false);
    const messageArray = result.messages;
    if (messageArray.length > 0) {
      setPreventAutoScroll(true);
      const msgs = [...messages, ...messageArray];
      setMessages(msgs.filter((m) => !m.doHideMessageInChat));
    }
  };

  const prevPageCallback: InboxCallbackResult<Message> = (resultEvent, result) => {
    if (!isMounted.current) return;

    setFetchingPrevMessages(false);
    const messageArray = result.messages;
    if (messageArray.length > 0) {
      const newMessages = [...messageArray, ...messages];
      setFirstItemIndex(firstItemIndex - newMessages.length + messages.length);
      setMessages(newMessages.filter((m) => !m.doHideMessageInChat));
    }
  };

  const loadPrev = () => {
    //  Adding timeout because virtuoso.current is not available immediately after the component mounts.
    setTimeout(() => {
      if (!virtuoso.current) return;
      setFetchingPrevMessages(true);
      pageDataSource?.prevPage(prevPageCallback);
    }, 100);
  };

  const loadNext = () => {
    //  Adding timeout because virtuoso.current is not available immediately after the component mounts.
    setTimeout(() => {
      if (!virtuoso.current) return;
      setNewIncomingMessages(false);
      setFetchingNextMessages(true);
      pageDataSource?.nextPage(nextPageCallback);
    }, 100);
  };

  useEffect(() => {
    const wsId = KristaId.parse(chatbotConfig.workspaceId);
    const chatId = KristaId.parse(sessionId);
    const newMessageCallback: InboxCallbackResult<Message> = (
      resultEvent,
      result
    ) => {
      if (!isMounted.current) return;

      const messageArray = result.messages;
      if (messageArray.length > 0) {
        setMessages((msgs) => {
          const updatedMessages = [...msgs, ...messageArray].filter((m) => !m.doHideMessageInChat);
          setIsWelcomeMessage(msgs.length === 0);
          return updatedMessages;
        });

        pageDataSource?.setBottomOffsetIfNull(messageArray[0].getId());
        pageDataSource?.setTopOffset(
          messageArray[messageArray.length - 1].getId()
        );
        if (resultEvent === ResultEvent.UserSentMessage) {
          setForceScrollToBottom(true);
        } else {
          setTimeout(() => {
            setNewIncomingMessages(true);
          });
        }
      }
    };
    SyncMessageService.getInstance().registerTimelineInboxSync(
      wsId,
      chatId,
      newMessageCallback
    );
  }, []);

  useEffect(() => {
    let wsId = KristaId.parse(chatbotConfig.workspaceId);
    let chatId = KristaId.parse(sessionId);
    if (!wsId || !chatId) {
      return;
    }
    pageDataSource?.nextPage(nextPageCallback);
  }, []);

  //destroy
  useEffect(() => {
    return () => {
      isMounted.current = false;
      pageDataSource?.close();
    };
  }, []);

  useEffect(() => {
    if (!unreadMessage.id) {
      const unreadMessage = getLastReadMessage(messages);
      if (unreadMessage) {
        setUnreadMessage(unreadMessage);
      }
    }
    setPreventAutoScroll(false);
    setForceScrollToBottom(false);
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // hide footer if the last message is "MessageAsk" and the form is active (not readonly)
      setHideFooter((lastMessage.messageType === MessageType.Ask &&
        (!lastMessage.form || !lastMessage.form.readOnly)));
    }
  }, [messages]);

  return (
    <React.Fragment>
      {/*{newIncomingMessages && !atBottom && (*/}
      {/*  <NewMessagesBtn*/}
      {/*    onClick={() => {*/}
      {/*      if (virtuoso.current) {*/}
      {/*        const x = virtuoso.current as any;*/}
      {/*        x.scrollToIndex({ index: messages.length, behavior: "smooth" });*/}
      {/*      }*/}
      {/*    }}*/}
      {/*  />*/}
      {/*)}*/}
      <Box
        sx={{height: "100%"}}
      >
        <Virtuoso
          ref={virtuoso}
          data={messages}
          alignToBottom
          initialTopMostItemIndex={
            unreadMessage.index !== -1
              ? unreadMessage.index
              : messages.length - 1
          }
          followOutput={() => {
            if ((!preventAutoScroll && atBottom) || forceScrollToBottom) {
              return "smooth";
            } else {
              return false;
            }
          }}
          endReached={loadNext}
          startReached={loadPrev}
          firstItemIndex={firstItemIndex}
          onScroll={(e) => detectBottom(e, atBottom, setAtBottom)}
          components={{
            Header: () => {
              if (fetchingPrevMessages) {
                return <ListLoader/>;
              }
              return null;
            },
            Footer: () => {
              if (fetchingNextMessages) {
                return <ListLoader/>;
              }
              return null;
            },
          }}
          itemContent={(index: number, message: Message) => {
            return (
              <Box sx={{px: 2}} key={message.uniqueKey}>
                <BannerWrapper
                  index={index}
                  unreadMessageId={unreadMessage.id}
                  firstItemIndex={firstItemIndex}
                  message={message}
                  messages={messages}
                ></BannerWrapper>
                <MessageListItem
                  key={message.uniqueKey}
                  message={message}
                  topicId={sessionId}
                  isWelcomeMessage={isWelcomeMessage}
                />
              </Box>
            );
          }}
        ></Virtuoso>
        {/* Typing indicator at bottom left of timeline */}
        {(isTyping && !hideFooter) && (
          <Box sx={{
            position: "absolute",
            bottom: "2px",
            left: "16px",
            zIndex: 10
          }}>
            <Box sx={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#f5f5f5",
              borderRadius: "12px",
              padding: "4px 8px",
              maxWidth: "fit-content"
            }}>
              <SvgIcon
                color="primary"
                viewBox="0 0 120 30"
                sx={{width: "24px", height: "6px"}}
              >
                <DotsStyleLoading/>
              </SvgIcon>
            </Box>
          </Box>
        )}
      </Box>
    </React.Fragment>
  );
}

const MessageListItem = React.memo(
  ({message, topicId, isWelcomeMessage}:
   { message: Message; topicId: string, isWelcomeMessage: boolean }) => {
    if (message.isSystemEventMessage) {
      return <SystemEventMessage key={message.uniqueKey} message={message}/>;
    }
    return (
      <MessageBubble
        key={message.uniqueKey}
        message={message}
        topicId={topicId}
        isWelcomeMessage={isWelcomeMessage}
      />
    );
  }
);
