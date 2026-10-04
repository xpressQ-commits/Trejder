export const locales = ["sv", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "sv";
export const localeCookie = "trejder_locale";
export function isLocale(value: unknown): value is Locale { return typeof value === "string" && locales.includes(value as Locale); }
