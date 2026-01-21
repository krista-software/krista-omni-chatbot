import { useEffect, useRef, useState } from "react";
import { Redirect, Switch } from "react-router-dom";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRecoilValue } from "recoil";
import {
  CallbackEvent,
  KristaUIToolkit,
  NotificationService,
  OutboundNotificationType,
  Signal,
} from "../../toolkit-src";
import { Footer } from "../components/footer/Footer";
import { Header } from "../components/header/Header";
import { LoginGuardedRoute } from "./LoginGuardedRoute";
import {constants} from "../constants";
import { configAtom, sessionIdAtom, userDataAtom } from "../atoms";
import { PrefStorage } from "../modules/storage/PrefStorage";
import { TimelineView } from "../components/shared/TimelineView";

interface LayoutStyleProps {
  hideHeader?: boolean;
  hideSendMessage?: boolean;
}

const LayoutStyle = styled("div")<LayoutStyleProps>(({ hideHeader, hideSendMessage }) => ({
  overflow: "hidden",
  height: "100vh",
  display: "grid",
  gridTemplateColumns: "1fr",
  gridTemplateRows: hideHeader ?
    `auto ${constants.getFooterHeight(hideSendMessage)}px` :
    `${constants.headerHeight}px auto ${constants.getFooterHeight(hideSendMessage)}px`,
  width: "100%",
}));

const ContentStyle = styled(Box)({
  height: "100%",
  flex: "1 0",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  position: "relative",
});

const RootStyle = styled("div")(({ theme }) => ({
  display: "flex",
  minHeight: "100%",
  overflow: "hidden",
  background: theme.palette.background.default,
}));

interface CustomWindow extends Window {
  workspaceId?: string | null;
}

export const App = () => {
  const config = useRecoilValue(configAtom);
  const userData = useRecoilValue(userDataAtom);
  const sessionId = useRecoilValue(sessionIdAtom);
  const welcomeConversationInitiated = useRef(false);
  const [isToolkitInitialized, setToolkitInitialized] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const [hideSendMessage, setHideSendMessage] = useState(false);

  useEffect(() => {
    setHideHeader(config.config.isFullSize || false);
    setHideSendMessage(config.config.hideSendMessage || false);
    const customWindow: CustomWindow = window;
    customWindow.workspaceId = config.workspaceId;
    const toolkit = KristaUIToolkit.getInstance();
    const bases = document.getElementsByTagName("base");
    let baseHref: string = "";
    if (bases.length > 0) {
      baseHref = bases[0].getAttribute("href") || "";
    }

    toolkit.init({
      workspaceId: config.workspaceId,
      nodeName: config.nodeName,
      clientSessionId: PrefStorage.getClientSessionId() || "",
      webSocketHost: baseHref,
      user: {
        id: PrefStorage.getMyContactId().id,
        name: PrefStorage.getName(),
      },
      callback: (event) => {
        if (event === CallbackEvent.webSocketConnected) {
          if (
            userData &&
            userData.extras.newSession &&
            !welcomeConversationInitiated.current
          ) {
            welcomeConversationInitiated.current = true;
            NotificationService.getInstance().sendNotification({
              signal: Signal.notification,
              payload: {
                type: OutboundNotificationType.Welcome,
                timestamp: Date.now(),
                payload: {
                  inboxId: sessionId,
                },
              },
            });
          }
        }
      },
    });
    setToolkitInitialized(true);
  }, [config, hideHeader]);

  if (!isToolkitInitialized) {
    return null;
  }

  return (
    <RootStyle>
      <LayoutStyle hideHeader={hideHeader} hideSendMessage={hideSendMessage}>
        {!hideHeader && <Header />}
        <ContentStyle>
          <Switch>
            <LoginGuardedRoute
              path="/chat"
              component={TimelineView}
            ></LoginGuardedRoute>
            <Redirect to="/chat" />
          </Switch>
        </ContentStyle>
        <Footer />
      </LayoutStyle>
    </RootStyle>
  );
};
