import { defaultLocale, type Locale } from "./config";
import { en } from "./messages/en";
import { sv, type TranslationKey } from "./messages/sv";
const messages = { sv, en } as const;
export function translate(locale: Locale, key: TranslationKey): string { return messages[locale]?.[key] ?? messages[defaultLocale][key] ?? key; }
export function formatMoney(locale: Locale, amountOre: number): string { return new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-US", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(amountOre / 100); }
export function formatDate(locale: Locale, value: Date | string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string { return new Intl.DateTimeFormat(locale === "sv" ? "sv-SE" : "en-US", { ...options, timeZone: options.timeZone ?? "Europe/Stockholm" }).format(new Date(value)); }
const notificationKeys = { "bid.received": "notifications.bidReceived", "question.received": "notifications.questionReceived", "question.answered": "notifications.questionAnswered", "bid.accepted": "notifications.bidAccepted", "bid.lost": "notifications.bidLost", "chat.message": "notifications.chatMessage" } as const satisfies Record<string, TranslationKey>;
export function formatNotification(locale: Locale, type: string, fallback: string): string { const key = notificationKeys[type as keyof typeof notificationKeys]; return key ? translate(locale, key) : fallback; }
export type { Locale, TranslationKey };
