"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { StartChatButton } from "@/components/chat/start-chat-button";
import {
  FormMessage,
  inputClassName,
  primaryButtonClassName,
} from "@/components/ui/form-controls";

type Question = {
  id: string;
  body: string;
  answerBody: string | null;
  authorLabel: string;
  answerAuthorLabel: string | null;
  createdAt: string;
};
type Bid = { id: string; amountOre: number; status: string };
const kronor = (ore: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(ore / 100);

export function MarketplaceInteractions({
  listingId,
  canBid,
}: {
  listingId: string;
  canBid: boolean;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [ownBid, setOwnBid] = useState<Bid | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    const [q, b] = await Promise.all([
      fetch(`/api/marketplace/${listingId}/questions`, { cache: "no-store" }),
      fetch(`/api/marketplace/${listingId}/bids`, { cache: "no-store" }),
    ]);
    if (q.ok)
      setQuestions(((await q.json()) as { questions: Question[] }).questions);
    if (b.ok) setOwnBid(((await b.json()) as { bid: Bid | null }).bid);
  }, [listingId]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch(`/api/marketplace/${listingId}/questions`, { cache: "no-store" }),
      fetch(`/api/marketplace/${listingId}/bids`, { cache: "no-store" }),
    ]).then(async ([q, b]) => {
      if (!active) return;
      if (q.ok)
        setQuestions(((await q.json()) as { questions: Question[] }).questions);
      if (b.ok) setOwnBid(((await b.json()) as { bid: Bid | null }).bid);
    });
    return () => {
      active = false;
    };
  }, [listingId]);
  async function bid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const data = new FormData(event.currentTarget);
    const amountOre = Math.round(Number(data.get("amount")) * 100);
    const response = await fetch(`/api/marketplace/${listingId}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountOre }),
    });
    setMessage(
      response.ok ? "Budet är registrerat." : "Budet kunde inte registreras.",
    );
    await load();
    setPending(false);
  }
  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/marketplace/${listingId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: data.get("body") }),
    });
    setMessage(
      response.ok
        ? "Frågan är publicerad."
        : "Frågan kunde inte publiceras. Kontaktuppgifter är inte tillåtna.",
    );
    if (response.ok) form.reset();
    await load();
    setPending(false);
  }
  return (
    <div className="mt-9 space-y-8 border-t border-[var(--border)] pt-8">
      {message ? (
        <FormMessage type={message.includes("kunde") ? "error" : "success"}>
          {message}
        </FormMessage>
      ) : null}
      {canBid ? (
        <section>
          <h2 className="text-xl font-semibold">Lägg bud</h2>
          {ownBid ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Ditt nuvarande bud:{" "}
              <strong className="text-[var(--foreground)]">
                {kronor(ownBid.amountOre)}
              </strong>
            </p>
          ) : null}
          <form onSubmit={bid} className="mt-3 flex max-w-md gap-3">
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              required
              aria-label="Bud i kronor"
              placeholder="Bud i kronor"
              className={inputClassName}
            />
            <button disabled={pending} className={primaryButtonClassName}>
              {ownBid ? "Uppdatera bud" : "Lägg bud"}
            </button>
          </form>
          {ownBid?.status === "active" || ownBid?.status === "accepted" ? (
            <div className="mt-4">
              <StartChatButton bidId={ownBid.id} canStart />
            </div>
          ) : null}
        </section>
      ) : null}
      <section>
        <h2 className="text-xl font-semibold">Frågor och svar</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Frågorna är offentliga och anonyma. Kontaktuppgifter får inte delas.
        </p>
        <div className="mt-4 space-y-3">
          {questions.map((question) => (
            <article
              key={question.id}
              className="rounded-xl border border-[var(--border)] p-4"
            >
              <p className="text-sm font-semibold">{question.authorLabel}</p>
              <p className="mt-1">{question.body}</p>
              {question.answerBody ? (
                <div className="mt-3 border-l-2 border-[var(--primary)] pl-3">
                  <p className="text-sm font-semibold">Säljaren</p>
                  <p>{question.answerBody}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Inväntar svar
                </p>
              )}
            </article>
          ))}
        </div>
        {canBid ? (
          <form onSubmit={ask} className="mt-4 max-w-xl space-y-3">
            <textarea
              name="body"
              required
              maxLength={1000}
              rows={3}
              placeholder="Ställ en offentlig fråga"
              className={`${inputClassName} resize-y`}
            />
            <button disabled={pending} className={primaryButtonClassName}>
              Publicera fråga
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
