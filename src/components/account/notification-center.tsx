"use client";
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { formatDate, formatNotification } from "@/i18n";
type Item = {
  id: string;
  type: string;
  body: string;
  readAt: string | Date | null;
  createdAt: string | Date;
};
export function NotificationCenter({
  initialItems,
}: {
  initialItems: Item[];
  initialLocale?: "sv" | "en";
}) {
  const { t, locale } = usePreferences();
  const [items, setItems] = useState(initialItems);
  const unread = items.some((item) => !item.readAt);
  useEffect(() => {
    const sync = (event: Event) => {
      const id = (event as CustomEvent<string | undefined>).detail;
      setItems((current) =>
        current.map((item) =>
          !id || item.id === id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
    };
    window.addEventListener("trejder-notifications-read", sync);
    return () => window.removeEventListener("trejder-notifications-read", sync);
  }, []);
  async function markRead() {
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (response.ok)
      window.dispatchEvent(new CustomEvent("trejder-notifications-read"));
  }
  return (
    <section id="notiser" className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{t("notifications.title")}</h2>
        {unread ? (
          <button
            type="button"
            onClick={() => void markRead()}
            className="font-semibold text-[var(--primary)] hover:underline"
          >
            {t("notifications.markRead")}
          </button>
        ) : null}
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 ${item.readAt ? "opacity-70" : ""}`}
          >
            <p>{formatNotification(locale, item.type, item.body)}</p>
            <time className="mt-1 block text-xs text-[var(--muted)]">
              {formatDate(locale, item.createdAt, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
