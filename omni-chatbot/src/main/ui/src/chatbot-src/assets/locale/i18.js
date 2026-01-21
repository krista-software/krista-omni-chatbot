import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {
  locale_en,
  locale_de,
  locale_es,
  locale_fr,
  locale_hi,
  locale_mr,
} from "../../../toolkit-src";
import { TRANSLATION_DE } from "./de";
import { TRANSLATION_EN } from "./en";
import { TRANSLATION_FR } from "./fr";
import { TRANSLATION_ES } from "./es";
import { TRANSLATION_HI } from "./hi";
import { TRANSLATION_MR } from "./mr";

const resources = {
  en: {
    translation: {
      ...TRANSLATION_EN,
      ...locale_en,
    },
  },
  de: {
    translation: {
      ...TRANSLATION_DE,
      ...locale_de,
    },
  },
  es: {
    translation: {
      ...TRANSLATION_ES,
      ...locale_es,
    },
  },
  fr: {
    translation: {
      ...TRANSLATION_FR,
      ...locale_fr,
    },
  },
  hi: {
    translation: {
      ...TRANSLATION_HI,
      ...locale_hi,
    },
  },
  mr: {
    translation: {
      ...TRANSLATION_MR,
      ...locale_mr,
    },
  },
};

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources,
    debug: false,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "querystring", "navigator", "subdomain"],
    },
  });

export default i18n;
