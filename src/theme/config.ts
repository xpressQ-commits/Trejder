export const themes = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themes)[number];
export const defaultTheme: ThemePreference = "system";
export const themeCookie = "trejder_theme";
export function isThemePreference(value: unknown): value is ThemePreference { return typeof value === "string" && themes.includes(value as ThemePreference); }
export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" { return preference === "system" ? (systemDark ? "dark" : "light") : preference; }
