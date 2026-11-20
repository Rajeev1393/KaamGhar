import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { acceptedLanguages, isLanguage, languageCookie, preferredLanguage } from "@/lib/language";
import { isTheme, themeCookie } from "@/lib/theme";
import "./globals.css";
import "./themes.css";

export const metadata: Metadata = {
  title: "KaamGhar — Home services, sorted",
  description: "Book trusted home-service professionals in your neighbourhood.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const savedLanguage = cookieStore.get(languageCookie)?.value ?? "";
  const choice = isLanguage(savedLanguage) ? savedLanguage : "";
  const language = choice || preferredLanguage(acceptedLanguages(requestHeaders.get("accept-language") ?? ""));
  const savedTheme = cookieStore.get(themeCookie)?.value ?? "";
  const theme = isTheme(savedTheme) ? savedTheme : "system";
  return (
    <html lang={language} data-theme={theme}>
      <body>
        <LanguageProvider initialLanguage={language} initialChoice={choice}>
          <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
