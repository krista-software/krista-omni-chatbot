import { useState, useCallback, useEffect } from "react";
import {Box, CircularProgress, MenuItem, Select} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useRecoilValue } from "recoil";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { configAtom } from "../../atoms";
import {logoutAPI} from "../../server/api/useLogoutAPI.ts";
import {useChatbotIcon} from "../../hooks/useChatbotIcon.ts";
import {createAjaxRequest, generateApiUrl} from "../../../toolkit-src";
import {GET_SUPPORTED_LANGUAGES} from "../../server/api/apiURLs.ts";
import {SelectChangeEvent} from "@mui/material/Select";
import {PrefStorage} from "../../modules/storage/PrefStorage.ts";

const handleCloseClick = () => {
  window.parent?.postMessage(`{"messageType": "minimize", "value":true}`, "*");
};

export const Header = () => {
  const [isReloading, setIsReloading] = useState(false);
  const chatbotConfig = useRecoilValue(configAtom);
  const [languages, setLanguages] = useState<{ name: string; code: string }[]>([]);
  const [selectedLang, setSelectedLang] = useState<string | null>("en");
  const [botNamePosition, setBotNamePosition] = useState<string | null>(null);

  // 1. Fetch languages on mount
  useEffect(() => {
    setSelectedLang(PrefStorage.getSelectedLanguage());
    setBotNamePosition(chatbotConfig.config.botNamePosition || "center");

    async function fetchLanguages() {
      try {
        const response = await createAjaxRequest({
          url: generateApiUrl(GET_SUPPORTED_LANGUAGES, {}),
          options: { method: "GET" },
        });
        setLanguages(response.data || []);
      } catch (err) {
        console.log("#####-ERROR FETCHING LANGUAGES = ", err);
      } finally {

      }
    }

    if (chatbotConfig.config.canChangeLanguage) {
      fetchLanguages();
    }
  }, []);

  const onClickStartOver = useCallback(() => {
    setIsReloading(true);
    const rememberLanguage = PrefStorage.getSelectedLanguage();
    logoutAPI().then(() => {
      const currentUrl = window.location.href;
      PrefStorage.setSelectedLanguage(rememberLanguage);
      if (currentUrl.endsWith('/chat')) {
        const newUrl = currentUrl.slice(0, -'chat'.length);
        const message = {messageType: "restartOnRefresh"};
        window.parent?.postMessage(JSON.stringify(message), "*");
        window.location.href = newUrl; // This will redirect (reloads with new URL)
        setIsReloading(false);
      } else {
        window.location.reload(); // Just reload if no change needed
      }
    });
  }, []);  // Empty dependency array means this function is created once

  function onLanguageChange(e: SelectChangeEvent<unknown>) {
    PrefStorage.setSelectedLanguage(e.target.value as string);
    onClickStartOver();
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        padding: "0 12px",
        background: "white",
        position: "relative",
      }}>
      <img alt="edit" src={useChatbotIcon()} style={{ maxHeight: 48, zIndex: 1, maxWidth : 138 }} />
      <Box
        sx={{
          flex: 1, // takes remaining space
          textAlign: botNamePosition,
          padding: "0 12px",
          whiteSpace: "normal", // allow wrapping
        }}>
        <Typography variant="h6" sx={{ fontSize: "1rem" }}>
          {chatbotConfig.config.botName || "Krista"}
        </Typography>
        {chatbotConfig.config.botSubTitle ? <Typography sx={{ fontSize: "0.9rem" }}>
          {chatbotConfig.config.botSubTitle || ""}
        </Typography> : null}
      </Box>
      <Box sx={{display: "flex", alignItems: "center", marginLeft: "auto", gap: "4px"}}>
        {(languages && languages.length > 0) ?
          <Select style={{width: "110px", height: "36px", marginRight: "8px"}}
                  value={selectedLang}
                  onChange={(e) => onLanguageChange(e)}
                  displayEmpty>
            {languages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.name}
              </MenuItem>
            ))}
          </Select> : null}
        <Box>
          {isReloading ? (<IconButton color="primary" sx={{width: "40px", height: "40px"}}>
              <CircularProgress size={16} color="primary"/>
            </IconButton>) :
            <IconButton onClick={onClickStartOver}
                        color="primary"
                        title="This will reset and start a new chat session.">
              <RefreshIcon/>
            </IconButton>}
        </Box>
        <IconButton
          onClick={handleCloseClick}
          color="primary"
          title="Close">
          <CloseOutlinedIcon/>
        </IconButton>
      </Box>
    </Box>
  );
};
