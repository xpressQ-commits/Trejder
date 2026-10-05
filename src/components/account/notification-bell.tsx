"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate, formatNotification } from "@/i18n";
import { usePreferences } from "@/components/preferences/preferences-provider";

export type HeaderNotification = {
  id: string;
  type: string;
  body: string;
  resourceType: string;
  resourceId: string;
  readAt: string | null;
  createdAt: string;
};

function destination(item: HeaderNotification) {
  if (item.resourceType === "match") return `/app/affarer/${item.resourceId}`;
  if (item.resourceType === "chat_thread")
    return `/app/chattar?thread=${item.resourceId}`;
  if (
    item.resourceType === "listing" &&
    (item.type === "bid.received" || item.type === "question.received")
  )
    return `/app/bilar/${item.resourceId}`;
  if (item.resourceType === "listing") return `/app/marknad/${item.resourceId}`;
  return "/app/oversikt#notiser";
}

export function NotificationBell({
  initialItems,
}: {
  initialItems: HeaderNotification[];
}) {
  const { locale } = usePreferences();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [showBrowserPrompt, setShowBrowserPrompt] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const knownIds = useRef(new Set(initialItems.map((item) => item.id)));
  const unread = items.filter((item) => !item.readAt).length;
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
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
  useEffect(() => {
    const promptTimer = window.setTimeout(
      () =>
        setShowBrowserPrompt(
          "Notification" in window &&
            Notification.permission === "default" &&
            localStorage.getItem("trejder_notification_prompt") !== "dismissed",
        ),
      0,
    );
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as {
        notifications: HeaderNotification[];
      };
      const fresh = next.notifications.filter(
        (item) => !knownIds.current.has(item.id) && !item.readAt,
      );
      fresh.forEach((item) => knownIds.current.add(item.id));
      setItems(next.notifications);
      if (
        fresh[0] &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Trejder", {
          body: formatNotification(locale, fresh[0].type, fresh[0].body),
        });
      }
    }, 30_000);
    return () => {
      window.clearTimeout(promptTimer);
      window.clearInterval(timer);
    };
  }, [locale]);
  async function mark(id?: string) {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    if (response.ok)
      window.dispatchEvent(
        new CustomEvent("trejder-notifications-read", { detail: id }),
      );
  }
  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        aria-label={unread ? `Notiser, ${unread} olästa` : "Notiser"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
      >
        <Bell aria-hidden="true" size={20} />
        {unread ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-5 rounded-full bg-[var(--danger)] px-1 text-center text-xs leading-5 font-bold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notiser"
          className="fixed top-20 right-4 left-4 z-50 flex max-h-[min(70vh,37.5rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xl lg:absolute lg:top-auto lg:right-0 lg:bottom-full lg:left-auto lg:mb-2 lg:w-[min(22rem,calc(100vw-2rem))]"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <strong>Notiser</strong>
            {unread ? (
              <button
                type="button"
                onClick={() => void mark()}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
              >
                <CheckCheck size={15} />
                Markera alla lästa
              </button>
            ) : null}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {items.length ? (
              items.slice(0, 10).map((item) => (
                <li
                  key={item.id}
                  className={`border-b border-[var(--border)] last:border-0 ${item.readAt ? "opacity-70" : "bg-[var(--surface-selected)]"}`}
                >
                  <Link
                    href={destination(item)}
                    onClick={() => {
                      void mark(item.id);
                      setOpen(false);
                    }}
                    className="block px-4 py-3 hover:bg-[var(--surface-subtle)]"
                  >
                    <p className="text-sm font-medium">
                      {formatNotification(locale, item.type, item.body)}
                    </p>
                    <time className="mt-1 block text-xs text-[var(--muted)]">
                      {formatDate(locale, item.createdAt, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </Link>
                </li>
              ))
            ) : (
              <li className="p-5 text-center text-sm text-[var(--muted)]">
                Inga notiser ännu.
              </li>
            )}
          </ul>
          {showBrowserPrompt ? (
            <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <p className="text-sm font-medium">
                Vill du få aviseringar om nya bud och meddelanden?
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const result = await Notification.requestPermission();
                    setShowBrowserPrompt(false);
                    if (result !== "granted")
                      localStorage.setItem(
                        "trejder_notification_prompt",
                        "dismissed",
                      );
                  }}
                  className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
                >
                  Aktivera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(
                      "trejder_notification_prompt",
                      "dismissed",
                    );
                    setShowBrowserPrompt(false);
                  }}
                  className="px-3 py-2 text-sm font-semibold text-[var(--muted)]"
                >
                  Inte nu
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
