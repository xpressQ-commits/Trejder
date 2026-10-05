"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import {
  FormMessage,
  primaryButtonClassName,
} from "@/components/ui/form-controls";
import type { DealerThread, DealerThreadDetail } from "./types";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { formatDate } from "@/i18n";

export function ChatCenter({
  initialThreads,
  initialThreadId,
  canSend,
}: {
  initialThreads: DealerThread[];
  initialThreadId?: string;
  canSend: boolean;
}) {
  const { t, locale } = usePreferences();
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState(
    initialThreadId ?? initialThreads[0]?.id,
  );
  const [detail, setDetail] = useState<DealerThreadDetail>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const loadThreads = useCallback(async () => {
    const response = await fetch("/api/chats", { cache: "no-store" });
    if (!response.ok) throw new Error();
    setThreads(
      ((await response.json()) as { threads: DealerThread[] }).threads,
    );
  }, []);

  const loadDetail = useCallback(async (threadId: string) => {
    const response = await fetch(`/api/chats/${threadId}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const next = (await response.json()) as DealerThreadDetail;
    setDetail(next);
    window.dispatchEvent(
      new CustomEvent("trejder-chat-unread", { detail: next.unreadCount }),
    );
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const initialTimer = window.setTimeout(() => {
      void loadDetail(selectedId).catch(() => setError(t("chat.loadError")));
    }, 0);
    const timer = window.setInterval(() => {
      void loadDetail(selectedId).catch(() => undefined);
    }, 10_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [loadDetail, loadThreads, selectedId, t]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !canSend) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();
    if (!body) return;
    setPending(true);
    setError(undefined);
    const response = await fetch(`/api/chats/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (response.ok) {
      const next = (await response.json()) as DealerThreadDetail;
      setDetail(next);
      window.dispatchEvent(
        new CustomEvent("trejder-chat-unread", { detail: next.unreadCount }),
      );
      form.reset();
      await loadThreads();
    } else setError(t("chat.sendError"));
    setPending(false);
  }

  return (
    <section aria-labelledby="chat-title">
      <p className="text-sm font-semibold text-[var(--primary)]">
        {t("chat.eyebrow")}
      </p>
      <h1
        id="chat-title"
        className="mt-1 text-3xl font-semibold tracking-tight"
      >
        {t("chat.title")}
      </h1>
      <p className="mt-2 text-[var(--muted)]">{t("chat.description")}</p>
      {error ? (
        <div className="mt-5">
          <FormMessage type="error">{error}</FormMessage>
        </div>
      ) : null}
      <div className="mt-7 grid min-h-[34rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] md:grid-cols-[18rem_1fr]">
        <aside className="border-b border-[var(--border)] md:border-r md:border-b-0">
          {threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--muted)]">
              <MessageCircle className="mx-auto mb-2" />
              {t("chat.noChats")}
            </div>
          ) : (
            <ul>
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(thread.id);
                      setError(undefined);
                    }}
                    className={`w-full border-b border-[var(--border)] p-4 text-left ${selectedId === thread.id ? "bg-[var(--success-surface)]" : "hover:bg-[var(--surface-subtle)]"}`}
                  >
                    <p className="font-semibold">{thread.listingLabel}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {thread.counterpartyLabel}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatDate(locale, thread.updatedAt, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="flex min-h-[28rem] flex-col">
          {!selectedId ? (
            <div className="m-auto p-6 text-center text-[var(--muted)]">
              {t("chat.choose")}
            </div>
          ) : !detail || detail.thread.id !== selectedId ? (
            <p role="status" className="p-6 text-[var(--muted)]">
              {t("chat.loading")}
            </p>
          ) : (
            <>
              <header className="border-b border-[var(--border)] p-4">
                <p className="font-semibold">{detail.thread.listingLabel}</p>
                <p className="text-sm text-[var(--muted)]">
                  {detail.thread.counterpartyLabel}
                  {detail.thread.viewerIsSeller &&
                  !detail.thread.identityRevealed
                    ? " · anonym köpare"
                    : ""}
                </p>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {detail.messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--muted)]">
                    {t("chat.none")}
                  </p>
                ) : (
                  detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.fromViewerCompany ? "ml-auto bg-[var(--primary)] text-white" : "bg-[var(--surface-subtle)]"}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.body}
                      </p>
                      <time
                        className={`mt-1 block text-xs ${message.fromViewerCompany ? "text-white/70" : "text-[var(--muted)]"}`}
                      >
                        {formatDate(locale, message.createdAt, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                  ))
                )}
              </div>
              {canSend ? (
                <form
                  onSubmit={send}
                  className="flex gap-2 border-t border-[var(--border)] p-4"
                >
                  <label className="sr-only" htmlFor="chat-body">
                    {t("chat.title")}
                  </label>
                  <textarea
                    id="chat-body"
                    name="body"
                    required
                    maxLength={2000}
                    rows={2}
                    placeholder={t("chat.placeholder")}
                    className="min-h-12 flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                  <button disabled={pending} className={primaryButtonClassName}>
                    {pending ? t("chat.sending") : t("chat.send")}
                  </button>
                </form>
              ) : (
                <p className="border-t border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  {t("chat.readOnly")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
