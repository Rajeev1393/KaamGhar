import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { LanguageProvider } from "@/components/LanguageProvider";
import { acceptedLanguages, isLanguage, languageCookie, preferredLanguage, type Language } from "@/lib/language";
import { translate } from "@/lib/messages";
import "./globals.css";

const getLanguageSettings = cache(async () => {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const savedLanguage = cookieStore.get(languageCookie)?.value ?? "";
  const choice: Language | "" = isLanguage(savedLanguage) ? savedLanguage : "";
  const language = choice || preferredLanguage(acceptedLanguages(requestHeaders.get("accept-language") ?? ""));
  return { language, choice };
});

export async function generateMetadata(): Promise<Metadata> {
  const { language } = await getLanguageSettings();
  return {
    title: `${translate(language, "Provider portal")} | KaamGhar`,
    description: translate(language, "Manage your KaamGhar service requests and professional profile."),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language, choice } = await getLanguageSettings();
  return (
    <html lang={language}>
      <body><LanguageProvider initialLanguage={language} initialChoice={choice}>{children}</LanguageProvider></body>
    </html>
  );
}
