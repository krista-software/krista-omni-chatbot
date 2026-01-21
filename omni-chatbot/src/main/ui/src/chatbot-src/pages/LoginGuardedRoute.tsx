import { useEffect, useState } from "react";
import { Route } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { ClientAPIClient } from "../../toolkit-src";
import { isLoggedInAtom } from "../atoms";

export const LoginGuardedRoute = (props: any) => {
  const isLoggedIn = useRecoilValue(isLoggedInAtom);
  const [isWebSocketConnected, setWebSocketConnected] = useState(false);

  useEffect(() => {
    if (isLoggedIn && !isWebSocketConnected) {
      setWebSocketConnected(true);
      ClientAPIClient.getInstance().openWebSocketConnection();
    }
  }, [isLoggedIn, isWebSocketConnected]);

  if (isLoggedIn && isWebSocketConnected) {
    return <Route {...props} />;
  }

  return null;
};
