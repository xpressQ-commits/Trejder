"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";
import type { DealerThread, DealerThreadDetail } from "./types";

export function ChatCenter({ initialThreads, initialThreadId, canSend }: {
  initialThreads: DealerThread[];
  initialThreadId?: string;
  canSend: boolean;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState(initialThreadId ?? initialThreads[0]?.id);
  const [detail, setDetail] = useState<DealerThreadDetail>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const loadThreads = useCallback(async () => {
    const response = await fetch("/api/chats", { cache: "no-store" });
    if (!response.ok) throw new Error();
    setThreads(((await response.json()) as { threads: DealerThread[] }).threads);
  }, []);

  const loadDetail = useCallback(async (threadId: string) => {
    const response = await fetch(`/api/chats/${threadId}`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    setDetail((await response.json()) as DealerThreadDetail);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const initialTimer = window.setTimeout(() => {
      void loadDetail(selectedId).catch(() => setError("Chatten kunde inte hämtas."));
    }, 0);
    const timer = window.setInterval(() => {
      void Promise.all([loadDetail(selectedId), loadThreads()]).catch(() => undefined);
    }, 5000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); };
  }, [loadDetail, loadThreads, selectedId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !canSend) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();
    if (!body) return;
    setPending(true); setError(undefined);
    const response = await fetch(`/api/chats/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (response.ok) {
      setDetail((await response.json()) as DealerThreadDetail);
      form.reset();
      await loadThreads();
    } else setError("Meddelandet kunde inte skickas.");
    setPending(false);
  }

  return <section aria-labelledby="chat-title">
    <p className="text-sm font-semibold text-[var(--primary)]">Säljare och köpare</p>
    <h1 id="chat-title" className="mt-1 text-3xl font-semibold tracking-tight">Chattar</h1>
    <p className="mt-2 text-[var(--muted)]">Köparen är anonym för säljaren tills ett vinnande bud har accepterats.</p>
    {error ? <div className="mt-5"><FormMessage type="error">{error}</FormMessage></div> : null}
    <div className="mt-7 grid min-h-[34rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-white md:grid-cols-[18rem_1fr]">
      <aside className="border-b border-[var(--border)] md:border-r md:border-b-0">
        {threads.length === 0 ? <div className="p-6 text-center text-sm text-[var(--muted)]"><MessageCircle className="mx-auto mb-2" />Inga chattar ännu.</div> : <ul>{threads.map((thread) => <li key={thread.id}><button type="button" onClick={() => { setSelectedId(thread.id); setError(undefined); }} className={`w-full border-b border-[var(--border)] p-4 text-left ${selectedId === thread.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}><p className="font-semibold">{thread.listingLabel}</p><p className="mt-1 text-sm text-[var(--muted)]">{thread.counterpartyLabel}</p><p className="mt-1 text-xs text-[var(--muted)]">{formatTime(thread.updatedAt)}</p></button></li>)}</ul>}
      </aside>
      <div className="flex min-h-[28rem] flex-col">
        {!selectedId ? <div className="m-auto p-6 text-center text-[var(--muted)]">Välj en chatt.</div> : !detail || detail.thread.id !== selectedId ? <p role="status" className="p-6 text-[var(--muted)]">Hämtar chatt…</p> : <>
          <header className="border-b border-[var(--border)] p-4"><p className="font-semibold">{detail.thread.listingLabel}</p><p className="text-sm text-[var(--muted)]">{detail.thread.counterpartyLabel}{detail.thread.viewerIsSeller && !detail.thread.identityRevealed ? " · anonym köpare" : ""}</p></header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">{detail.messages.length === 0 ? <p className="text-center text-sm text-[var(--muted)]">Inga meddelanden ännu.</p> : detail.messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.fromViewerCompany ? "ml-auto bg-[var(--primary)] text-white" : "bg-slate-100"}`}><p className="whitespace-pre-wrap text-sm">{message.body}</p><time className={`mt-1 block text-xs ${message.fromViewerCompany ? "text-white/70" : "text-[var(--muted)]"}`}>{formatTime(message.createdAt)}</time></div>)}</div>
          {canSend ? <form onSubmit={send} className="flex gap-2 border-t border-[var(--border)] p-4"><label className="sr-only" htmlFor="chat-body">Meddelande</label><textarea id="chat-body" name="body" required maxLength={2000} rows={2} placeholder="Skriv ett meddelande…" className="min-h-12 flex-1 resize-none rounded-lg border border-[var(--border)] px-3 py-2" /><button disabled={pending} className={primaryButtonClassName}>{pending ? "Skickar…" : "Skicka"}</button></form> : <p className="border-t border-[var(--border)] p-4 text-sm text-[var(--muted)]">Du har läsbehörighet och kan inte skicka meddelanden.</p>}
        </>}
      </div>
    </div>
  </section>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(value));
}
