"use client";

import { useEffect, useState } from "react";
import type { PlatformMessage, PlatformThread } from "./types";

export function PlatformChatMonitor({ initialThreads }: { initialThreads: PlatformThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState(initialThreads[0]?.id);
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [error, setError] = useState(false);
  const selected = threads.find((thread) => thread.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    async function load() {
      const [listResponse, detailResponse] = await Promise.all([
        fetch("/api/platform/chats", { cache: "no-store" }),
        fetch(`/api/platform/chats/${selectedId}`, { cache: "no-store" }),
      ]);
      if (!listResponse.ok || !detailResponse.ok) throw new Error();
      const list = (await listResponse.json()) as { threads: PlatformThread[] };
      const detail = (await detailResponse.json()) as { messages: PlatformMessage[] };
      if (active) { setThreads(list.threads); setMessages(detail.messages); setError(false); }
    }
    void load().catch(() => { if (active) setError(true); });
    const timer = window.setInterval(() => void load().catch(() => undefined), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedId]);

  return <div className="mt-7 grid min-h-[36rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-white md:grid-cols-[22rem_1fr]">
    <aside className="border-b border-[var(--border)] md:border-r md:border-b-0">{threads.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">Inga pågående chattar.</p> : <ul>{threads.map((thread) => <li key={thread.id}><button type="button" onClick={() => setSelectedId(thread.id)} className={`w-full border-b border-[var(--border)] p-4 text-left ${selectedId === thread.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}><p className="font-semibold">{thread.listingLabel}</p><p className="mt-1 text-sm">{thread.sellerCompanyName} ↔ {thread.buyerCompanyName}</p><p className="mt-1 text-xs text-[var(--muted)]">{thread.identityRevealed ? "Identitet släppt för parterna" : "Köparen anonym för säljaren"}</p></button></li>)}</ul>}</aside>
    <section className="flex flex-col"><header className="border-b border-[var(--border)] p-5"><h2 className="font-semibold">{selected?.listingLabel ?? "Välj en chatt"}</h2>{selected ? <p className="text-sm text-[var(--muted)]">Säljare: {selected.sellerCompanyName} · Köpare: {selected.buyerCompanyName}</p> : null}</header>{error ? <p role="alert" className="p-5 text-[var(--danger)]">Chatten kunde inte hämtas.</p> : <div className="flex-1 space-y-3 overflow-y-auto p-5">{messages.map((message) => <article key={message.id} className="rounded-xl border border-[var(--border)] bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{message.senderCompanyName} · {message.senderUserName}</p><time className="text-xs text-[var(--muted)]">{formatTime(message.createdAt)}</time></div><p className="text-xs text-[var(--muted)]">{message.senderUserEmail}</p><p className="mt-3 whitespace-pre-wrap text-sm">{message.body}</p></article>)}{selected && messages.length === 0 ? <p className="text-sm text-[var(--muted)]">Inga meddelanden ännu.</p> : null}</div>}</section>
  </div>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(value));
}
