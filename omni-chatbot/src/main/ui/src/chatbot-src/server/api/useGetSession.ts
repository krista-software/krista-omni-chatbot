import { useEffect, useState } from "react";
import { createAjaxRequest, generateApiUrl } from "../../../toolkit-src";
import { GET_SESSION } from "./apiURLs";
import {PrefStorage} from "../../modules/storage/PrefStorage.ts";

export const useGetSession = () => {
  const [inbox, setInbox] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    createAjaxRequest({
      url: generateApiUrl(GET_SESSION, {}),
      options: {
        method: "POST",
      },
      data: {
        languageCode: PrefStorage.getSelectedLanguage(),
      }
    })
      .then((response) => {
        setInbox(response.data);
      })
      .catch((err) => {
        setError("Unable to load session. Please refresh and try again");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { inbox, loading, error };
};
