import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, localeCookie, type Locale } from "./config";
import { translate } from "./index";
import type { TranslationKey } from "./messages/sv";
import { getAuthenticatedUser } from "@/server/company/context";
import { getUserPreferences } from "@/server/preferences";
export async function getRequestLocale(): Promise<Locale> { const current = await getAuthenticatedUser(await headers()); if (current) return (await getUserPreferences(current.id)).locale; const value = (await cookies()).get(localeCookie)?.value; return isLocale(value) ? value : defaultLocale; }
export async function getTranslations() { const locale = await getRequestLocale(); return { locale, t: (key: TranslationKey) => translate(locale, key) }; }
