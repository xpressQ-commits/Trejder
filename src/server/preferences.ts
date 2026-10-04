import { eq } from "drizzle-orm";
import { isLocale, type Locale } from "@/i18n/config";
import { isThemePreference, type ThemePreference } from "@/theme/config";
import { getDb } from "@/server/db";
import { user } from "@/server/db/schema";
import { AccessError } from "@/server/security";

export type UserPreferences = { theme: ThemePreference; locale: Locale };
export async function getUserPreferences(userId: string): Promise<UserPreferences> { const [row] = await getDb().select({ theme: user.themePreference, locale: user.preferredLocale }).from(user).where(eq(user.id, userId)).limit(1); return { theme: isThemePreference(row?.theme) ? row.theme : "system", locale: isLocale(row?.locale) ? row.locale : "sv" }; }
export async function updateUserPreferences(userId: string, input: UserPreferences) { if (!isThemePreference(input.theme) || !isLocale(input.locale)) throw new AccessError(400, "INVALID_PREFERENCES"); const [updated] = await getDb().update(user).set({ themePreference: input.theme, preferredLocale: input.locale }).where(eq(user.id, userId)).returning({ id: user.id }); if (!updated) throw new AccessError(404, "USER_NOT_FOUND"); return input; }
