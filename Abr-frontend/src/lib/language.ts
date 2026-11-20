export const languages = {
  en: "English",
  hi: "हिन्दी",
  pa: "ਪੰਜਾਬੀ",
  mr: "मराठी",
};

export type Language = keyof typeof languages;
export const languageCookie = "kaamghar-language";

export function isLanguage(value: string): value is Language {
  return Object.hasOwn(languages, value);
}

export function preferredLanguage(preferences: readonly string[]): Language {
  for (const preference of preferences) {
    const base = preference.trim().toLowerCase().split("-")[0];
    if (isLanguage(base)) return base;
  }
  return "en";
}

export function acceptedLanguages(header: string) {
  return header.split(",").map((entry) => {
    const [tag, quality] = entry.trim().split(/;\s*q=/i);
    return { tag, weight: quality === undefined ? 1 : Number(quality) };
  }).filter(({ weight }) => weight > 0 && weight <= 1)
    .sort((a, b) => b.weight - a.weight)
    .map(({ tag }) => tag);
}
