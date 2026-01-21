import React, { useState, MouseEvent, useEffect, useMemo } from "react";
import { PaletteMode } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { styled } from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import Menu from "@mui/material/Menu";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import LanguageIcon from "@mui/icons-material/Language";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import Select from "@mui/material/Select";
import { Box } from "@mui/material";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import i18next from "i18next";
import { KristaUIToolkit } from "../../../toolkit-src";
import { PrefStorage } from "../../modules/storage/PrefStorage";
import gbSvg from "../../assets/images/gb.svg";
import esSvg from "../../assets/images/es.svg";
import frSvg from "../../assets/images/fr.svg";
import deSvg from "../../assets/images/de.svg";
import inSvg from "../../assets/images/in.svg";
import { Switch } from "./Switch";

const MenuItemStyle = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(1, 2),
}));

export const i18nLanguages = [
  {
    title: "English",
    key: "en",
    image: gbSvg,
  },
  {
    title: "Deutsch",
    key: "de",
    image: deSvg,
  },
  {
    title: "Español",
    key: "es",
    image: esSvg,
  },
  {
    title: "Français",
    key: "fr",
    image: frSvg,
  },
  {
    title: "हिंदी",
    key: "hi",
    image: inSvg,
  },
  {
    title: "मराठी",
    key: "mr",
    image: inSvg,
  },
];

const getUserDetails = (): { name: string; email: string } => {
  const userDetails = PrefStorage.getLoggedInDetails();
  let user = { name: "", email: "" };
  if (userDetails) {
    if (userDetails.name) {
      user.name = userDetails.name;
    }
    if (userDetails.identificationToken?.email) {
      user.email = userDetails.identificationToken.email;
    }
  }
  return user;
};

const SettingMenu = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const user = useMemo(() => getUserDetails(), []);
  // const [width, setWidth] = useState(() => {
  //   // TODO storage solution
  //   const _width = window.localStorage.getItem("KristaCBWidth");
  //   return _width || 0.3;
  // });
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(i18next.resolvedLanguage);
  const [theme, setTheme] = useState<PaletteMode | undefined>(undefined);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (event: any) => {
    const val = event.target.value;
    setLanguage(val);
    i18n.changeLanguage(val);
    dayjs.locale(val);
    window.localStorage.setItem("KristaChatbotLanguage", val);
  };

  const toggleTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTheme = e.target.checked ? "dark" : "light";
    setTheme(newTheme);
    const themeService = KristaUIToolkit.getInstance().getThemeService();
    themeService.setTheme(newTheme);
  };

  // const handleWidthChange = (event: any) => {
  //   const val = event.target.value;
  //   setWidth(val);
  //   // TODO storage solution
  //   window.localStorage.setItem("KristaCBWidth", val);
  //   if (window && window.parent) {
  //     window.parent?.postMessage(`{"messageType": "windowResize", "value":${val}}`, "*");
  //   }
  // };

  useEffect(() => {
    const themeService = KristaUIToolkit.getInstance().getThemeService();
    setTheme(themeService.getSelectedTheme());
    // themeService.getAllThemes().then((_themes) => {
    //   setTheme(themeService.getSelectedThemeSettings().mode);
    // });
  }, []);

  return (
    <>
      <IconButton
        aria-label="User preferences"
        aria-controls="header-menu"
        aria-haspopup="true"
        onClick={handleClick}
        color="primary"
        size="large"
      >
        <AccountCircleIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        id="header-menu"
        open={open}
        onClose={handleClose}
        variant="selectedMenu"
      >
        <MenuItemStyle>
          <Typography>{user.name}</Typography>
          <Typography sx={{ color: "text.secondary" }} variant="caption">
            {user.email}
          </Typography>
        </MenuItemStyle>
        <Divider sx={{ my: 1 }} />
        <MenuItemStyle>
          <Stack direction="row" alignItems="center">
            <LanguageIcon sx={{ mr: 1, fontSize: "1.2rem" }} />
            <Typography variant="body1">Language</Typography>
            <FormControl
              variant="standard"
              sx={{
                marginLeft: "auto",
                "& .MuiInput-root": {
                  "&:before, &:after": { border: "none !important" },
                },
                "& .MuiSelect-select": { background: "none !important" },
              }}
            >
              <Select
                defaultValue="en"
                value={language}
                onChange={handleLanguageChange}
                sx={{
                  "& .MuiSelect-select": {
                    display: "flex",
                  },
                }}
              >
                {i18nLanguages.map((lang) => (
                  <MenuItem value={lang.key} key={lang.key}>
                    <Box
                      component="img"
                      src={lang.image}
                      sx={{
                        width: 16,
                        mr: 1,
                        borderRadius: 0.5,
                        alignSelf: "center",
                      }}
                    />
                    {lang.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </MenuItemStyle>
        {/* {!isInIframe && (
          <MenuItemStyle>
            <FormControl variant="standard">
              <InputLabel>Width</InputLabel>
              <Select defaultValue={0.3} value={width} onChange={handleWidthChange}>
                <MenuItem value={0.3}>1 / 3</MenuItem>
                <MenuItem value={0.5}>1 / 2</MenuItem>
              </Select>
            </FormControl>
          </MenuItemStyle>
        )} */}
        <MenuItemStyle>
          <Stack direction="row" alignItems="center">
            <DarkModeIcon sx={{ mr: 1, fontSize: "1.2rem" }} />
            <Typography variant="body1">Dark Mode</Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  color="primary"
                  checked={theme === "dark"}
                  onChange={toggleTheme}
                />
              }
              label={null}
              sx={{ margin: "0 0 0 auto" }}
            />
          </Stack>
        </MenuItemStyle>
      </Menu>
    </>
  );
};

export default React.memo(SettingMenu);
