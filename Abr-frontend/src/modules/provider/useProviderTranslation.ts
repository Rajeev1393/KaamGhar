"use client";

import { useCallback } from "react";
import { useTranslation } from "@/components/LanguageProvider";
import { providerMessage } from "./messages";

export function useProviderTranslation() {
  const { t, language, locale } = useTranslation();
  const translate = useCallback((source: string, values?: Record<string, string | number>) => {
    return t(providerMessage(language, source), values);
  }, [t, language]);
  return { t: translate, language, locale };
}
