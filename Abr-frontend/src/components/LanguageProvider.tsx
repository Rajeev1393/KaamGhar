"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { isLanguage, languageCookie, languages, preferredLanguage, type Language } from "@/lib/language";
import { messages } from "@/lib/messages";

type LanguageSettings = {
  language: Language;
  choice: Language | "";
  choose: (choice: Language | "") => void;
};

const LanguageContext = createContext<LanguageSettings>({ language: "en", choice: "", choose: () => {} });

export function LanguageProvider({ initialLanguage, initialChoice, children }: {
  initialLanguage: Language;
  initialChoice: Language | "";
  children: ReactNode;
}) {
  const [choice, setChoice] = useState(initialChoice);
  const [deviceLanguage, setDeviceLanguage] = useState(initialLanguage);
  const language = choice || deviceLanguage;

  useEffect(() => {
    function syncDeviceLanguage() {
      setDeviceLanguage(preferredLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
    }
    syncDeviceLanguage();
    window.addEventListener("languagechange", syncDeviceLanguage);
    return () => window.removeEventListener("languagechange", syncDeviceLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function choose(next: Language | "") {
    document.cookie = `${languageCookie}=${next}; Path=/; Max-Age=${next ? 31536000 : 0}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setChoice(next);
  }

  return <LanguageContext.Provider value={{ language, choice, choose }}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const { language } = useContext(LanguageContext);
  const t = useCallback((source: string, values?: Record<string, string | number>) => {
    const translation = language === "en" ? source : messages.get(source)?.[language] || source;
    return values ? translation.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token)) : translation;
  }, [language]);
  return { language, locale: `${language}-IN`, t };
}

export function LanguageChooser() {
  const { choice, choose } = useContext(LanguageContext);
  const { t } = useTranslation();
  return <label className="language-chooser">
    <Globe size={16} aria-hidden="true" />
    <select aria-label={t("Language")} value={choice} onChange={(event) => {
      const value = event.target.value;
      if (value === "" || isLanguage(value)) choose(value);
    }}>
      <option value="">{t("Device language")}</option>
      {Object.entries(languages).map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}
    </select>
  </label>;
}
