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

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) =>
    character.charCodeAt(0),
  );
}

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
  desktopPlacement = "sidebar",
  showPushOnboarding = false,
}: {
  initialItems: HeaderNotification[];
  desktopPlacement?: "sidebar" | "header";
  showPushOnboarding?: boolean;
}) {
  const { locale } = usePreferences();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [showBrowserPrompt, setShowBrowserPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);
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
    let cancelled = false;
    const initializePush = async () => {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      )
        return;
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true);
      if (!cancelled) {
        setIsStandalone(standalone);
        setShowBrowserPrompt(
          !subscription &&
            Notification.permission !== "denied" &&
            localStorage.getItem("trejder_push_onboarding_v2") !== "dismissed",
        );
      }
    };
    void initializePush().catch(() => undefined);
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
        Notification.permission === "granted" &&
        !("PushManager" in window)
      ) {
        new Notification("Trejder", {
          body: formatNotification(locale, fresh[0].type, fresh[0].body),
        });
      }
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [locale]);
  async function enablePush() {
    setEnablingPush(true);
    setPushMessage(null);
    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setPushMessage(
          "Den här webbläsaren saknar stöd. På iPhone behöver Trejder först läggas till på hemskärmen.",
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        localStorage.setItem("trejder_push_onboarding_v2", "dismissed");
        setPushMessage("Notiser är blockerade i webbläsarens inställningar.");
        return;
      }
      const keyResponse = await fetch("/api/push-subscriptions", {
        cache: "no-store",
      });
      if (!keyResponse.ok) throw new Error("PUSH_NOT_CONFIGURED");
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        }));
      const saved = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!saved.ok) throw new Error("PUSH_SAVE_FAILED");
      localStorage.removeItem("trejder_push_onboarding_v2");
      setShowBrowserPrompt(false);
      setPushMessage("Mobilnotiser är aktiverade på den här enheten.");
    } catch {
      setPushMessage("Notiser kunde inte aktiveras. Försök igen om en stund.");
    } finally {
      setEnablingPush(false);
    }
  }
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
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 ${
          desktopPlacement === "header"
            ? "lg:border-[var(--border)] lg:bg-[var(--surface)] lg:text-[var(--foreground)] lg:shadow-sm lg:hover:bg-[var(--surface-subtle)]"
            : ""
        }`}
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
          className={`fixed top-20 right-4 left-4 z-50 flex max-h-[min(70vh,37.5rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xl lg:w-[min(22rem,calc(100vw-2rem))] ${
            desktopPlacement === "header"
              ? "lg:absolute lg:top-full lg:right-0 lg:bottom-auto lg:left-auto lg:mt-2"
              : "lg:absolute lg:top-auto lg:right-auto lg:bottom-full lg:left-0 lg:mb-2"
          }`}
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
          {showBrowserPrompt || pushMessage ? (
            <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              {pushMessage ? (
                <p className="text-sm font-medium">{pushMessage}</p>
              ) : null}
              {showBrowserPrompt ? (
                <>
                  <p className="text-sm font-medium">
                    Vill du få mobilnotiser om nya bud och meddelanden, även när
                    Trejder är stängt?
                  </p>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      disabled={enablingPush}
                      onClick={() => void enablePush()}
                      className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {enablingPush ? "Aktiverar…" : "Aktivera"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem(
                          "trejder_push_onboarding_v2",
                          "dismissed",
                        );
                        setShowBrowserPrompt(false);
                      }}
                      className="px-3 py-2 text-sm font-semibold text-[var(--muted)]"
                    >
                      Inte nu
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {showPushOnboarding && isStandalone && showBrowserPrompt ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="push-onboarding-title"
          className="fixed inset-0 z-[70] flex items-end bg-black/55 p-4 sm:items-center sm:justify-center"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-selected)] text-[var(--primary)]">
              <Bell aria-hidden="true" size={22} />
            </div>
            <h2 id="push-onboarding-title" className="mt-4 text-xl font-bold">
              Aktivera mobilnotiser
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Få besked direkt om nya bud, frågor och meddelanden – även när
              Trejder inte är öppet.
            </p>
            {pushMessage ? (
              <p className="mt-3 text-sm font-medium">{pushMessage}</p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={enablingPush}
                onClick={() => void enablePush()}
                className="min-h-11 flex-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {enablingPush ? "Aktiverar…" : "Aktivera notiser"}
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(
                    "trejder_push_onboarding_v2",
                    "dismissed",
                  );
                  setShowBrowserPrompt(false);
                }}
                className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--muted)]"
              >
                Inte nu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
