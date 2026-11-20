export const themeCookie = "kaamghar-theme";
export const themeOptions = { system: "System", light: "Light", dark: "Dark" } as const;
export type Theme = keyof typeof themeOptions;

export function isTheme(value: string): value is Theme {
  return Object.hasOwn(themeOptions, value);
}
