import {createAjaxRequest, generateApiUrl} from "../../../toolkit-src";
import {LOGOUT} from "./apiURLs.ts";
import {PrefStorage} from "../../modules/storage/PrefStorage.ts";
import {delete_cookie} from "../../utils";

export async function logoutAPI() {
  return createAjaxRequest({
    url: generateApiUrl(LOGOUT, {}),
    options: {
      method: "POST",
    },
  })
    .then((response) => {
      PrefStorage.logOut();
      delete_cookie("chatbotSessionId");
    })
    .catch((err) => {
      console.log("#####-LOGOUT ERROR = ", err);
    });
}
