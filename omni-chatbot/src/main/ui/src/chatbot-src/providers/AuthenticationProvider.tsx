import { CircularProgress, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {useRecoilState, useRecoilValue, useSetRecoilState} from "recoil";
import { PrefStorage } from "../modules/storage/PrefStorage";
import {delete_cookie, isInIframe, set_cookie} from "../utils";
import {configAtom, isLoggedInAtom, queryParamsOfHostedSite, userDataAtom} from "../atoms";
import { LoaderContainer } from "../components/shared/LoaderContainer";
import { PERSON_ATTRIBUTES } from "../server/api/apiURLs";
import {createAjaxRequest, generateApiUrl} from "../../toolkit-src";
import {logoutAPI} from "../server/api/useLogoutAPI.ts";

type StateTypes =
  | "idle"
  | "login"
  | "done"
  | "loginNotSupported"
  | "loginFailed"
  | "requestLogin"
  | "startSession";

export const AuthenticationProvider = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [IsLoggedIn, setIsLoggedIn] = useRecoilState(isLoggedInAtom);
  const setUserData = useSetRecoilState(userDataAtom);
  const setQueryData = useSetRecoilState(queryParamsOfHostedSite);
  const [state, setState] = useState<StateTypes>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const { t } = useTranslation();
  const [clicked, setClicked] = useState(false);
  const [metadata, setMetaData] = useState({});
  const config = useRecoilValue(configAtom);

  async function upsertAttributes(attributes: {}) {
    if (!attributes || Object.keys(attributes).length === 0) {
      return;
    }

    createAjaxRequest({
      url: generateApiUrl(PERSON_ATTRIBUTES, {}),
      data: attributes,
      options: {
        method: "POST",
      },
    })
      .then((data) => {
      })
      .catch((error) => {
        console.log("PERSON ATTRIBUTES API FAILED...", error);
      });
  }

  useEffect(() => {

    if (!isInIframe) {
      const params = new URLSearchParams(window.location.search);
      const obj: { [key: string]: string } = {};
      params.forEach((value, key) => {
        obj[key] = value;
      });
      setQueryData(obj);
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const eventData = event.data;
        if (typeof eventData === "object") return;
        const eventDataJson = JSON.parse(eventData);
        const { messageType } = eventDataJson;
        switch (messageType) {
          case "chatbotIconClicked":  // To support old launcher.js
            console.log("#####META DATA => ", eventDataJson.metadata);
            setMetaData(eventDataJson.metadata);
            setClicked(true);
            break;

          case "dataToChatbot":
            setMetaData(eventDataJson.metadata);
            setQueryData(eventDataJson.queryParams);
            setClicked(true);
            break;

          case "upsertPersonAttributes":  // This is not used as of now but can be used in the future
            upsertAttributes(eventDataJson.metadata);
            break;

          default:
            break;
        }
      } catch (e) {
        console.log("Invalid message", e);
      }
    }
    window.addEventListener("message", handleMessage, false);

    setTimeout(() => {
      window.parent?.postMessage(`{"messageType": "initDone"}`, "*");
    }, 1);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    if (isInIframe && !clicked) return;
    // ------ delete -----
    (async () => {
      try {
        if (window.Authenticator) {
          // TODO fix it for all auth extensions
          window.Authenticator.init({ url: "chatbot" });

          if (config?.config?.restartOnRefresh == true && PrefStorage.getClientSessionId()) {
            await logoutAPI();
          }

          setState("login");
          const respData = await window.Authenticator.login();
          if (respData) {
            PrefStorage.setLoggedInDetails(respData);
            await upsertAttributes(metadata);
          }
          window.Authenticator.init({ url: "chatbot", data: respData });
          setUserData(respData);
          if (!isInIframe) {
            set_cookie("chatbotSessionId", respData.clientSessionId);
          }
          setIsLoggedIn(true);
          setState("done");
        } else {
          setState("loginNotSupported");
        }
      } catch (e: any) {
        if (!isInIframe) {
          delete_cookie("chatbotSessionId");
        }
        setState("loginFailed");
        setErrorMessage(e?.errorMessage || "Login failed.");
      }
    })();
  }, [clicked, setIsLoggedIn, setUserData]);

  let jsx = null;

  switch (state) {
    case "login":
      jsx = (
        <LoaderContainer>
          <CircularProgress />
        </LoaderContainer>
      );
      break;
    case "loginFailed":
      jsx = (
        <LoaderContainer>
          <Typography variant="body2">
            {errorMessage || t("authProvider.failedToLogin")}
          </Typography>
        </LoaderContainer>
      );
      break;
    case "loginNotSupported":
      jsx = (
        <LoaderContainer>
          <Typography variant="body2">
            {t("general.defaultApiErrorMessage")}
          </Typography>
        </LoaderContainer>
      );
      break;
    case "done":
      jsx = IsLoggedIn ? children : null;
      break;
    default:
      jsx = null;
  }
  return jsx;
};
