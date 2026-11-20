"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "@/components/LanguageProvider";
import { isTheme, themeCookie, themeOptions, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: Theme; choose: (theme: Theme) => void }>({
  theme: "system",
  choose: () => {},
});

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);

  function choose(next: Theme) {
    document.cookie = `${themeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  return <ThemeContext.Provider value={{ theme, choose }}>{children}</ThemeContext.Provider>;
}

export function ThemeChooser() {
  const { theme, choose } = useContext(ThemeContext);
  const { t } = useTranslation();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return <label className="language-chooser theme-chooser">
    <Icon size={16} aria-hidden="true" />
    <select aria-label={t("Theme")} value={theme} onChange={(event) => {
      const value = event.target.value;
      if (isTheme(value)) choose(value);
    }}>
      {Object.entries(themeOptions).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
    </select>
  </label>;
}
