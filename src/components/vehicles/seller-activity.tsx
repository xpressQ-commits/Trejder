"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  FormMessage,
  inputClassName,
  primaryButtonClassName,
} from "@/components/ui/form-controls";
import { StartChatButton } from "@/components/chat/start-chat-button";
type Bid = {
  id: string;
  amountOre: number;
  status: string;
  bidderLabel: string;
  updatedAt: string;
};
type Question = {
  id: string;
  body: string;
  answerBody: string | null;
  authorLabel: string;
};
const kronor = (ore: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(ore / 100);

export function SellerActivity({ listingId }: { listingId: string }) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState<string>();
  const load = useCallback(async () => {
    const [b, q] = await Promise.all([
      fetch(`/api/company/listings/${listingId}/bids`, { cache: "no-store" }),
      fetch(`/api/company/listings/${listingId}/questions`, {
        cache: "no-store",
      }),
    ]);
    if (b.ok) setBids(((await b.json()) as { bids: Bid[] }).bids);
    if (q.ok)
      setQuestions(((await q.json()) as { questions: Question[] }).questions);
  }, [listingId]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch(`/api/company/listings/${listingId}/bids`, { cache: "no-store" }),
      fetch(`/api/company/listings/${listingId}/questions`, {
        cache: "no-store",
      }),
    ]).then(async ([b, q]) => {
      if (!active) return;
      if (b.ok) setBids(((await b.json()) as { bids: Bid[] }).bids);
      if (q.ok)
        setQuestions(((await q.json()) as { questions: Question[] }).questions);
    });
    return () => {
      active = false;
    };
  }, [listingId]);
  async function accept(item: Bid) {
    if (
      !window.confirm(
        `Acceptera bindande bud ${kronor(item.amountOre)} från ${item.bidderLabel}?`,
      )
    )
      return;
    setPending(item.id);
    const response = await fetch(
      `/api/company/listings/${listingId}/bids/${item.id}/accept`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bindingConfirmed: true }),
      },
    );
    setMessage(
      response.ok
        ? "Budet har accepterats. Kontaktuppgifter är nu synliga i affären."
        : "Budet kunde inte accepteras.",
    );
    await load();
    setPending(undefined);
  }
  async function answer(event: FormEvent<HTMLFormElement>, question: Question) {
    event.preventDefault();
    setPending(question.id);
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(
      `/api/company/listings/${listingId}/questions/${question.id}/answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: data.get("body") }),
      },
    );
    setMessage(
      response.ok
        ? "Svaret är publicerat."
        : "Svaret kunde inte publiceras. Kontaktuppgifter är inte tillåtna.",
    );
    await load();
    setPending(undefined);
  }
  return (
    <div className="mt-9 grid gap-7 lg:grid-cols-2">
      {message ? (
        <div className="lg:col-span-2">
          <FormMessage type={message.includes("kunde") ? "error" : "success"}>
            {message}
          </FormMessage>
        </div>
      ) : null}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-semibold">Bud</h2>
        <div className="mt-4 space-y-3">
          {bids.length ? (
            bids.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[var(--border)] p-4"
              >
                <p className="font-semibold">{item.bidderLabel}</p>
                <p className="mt-1 text-xl font-semibold">
                  {kronor(item.amountOre)}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {item.status === "active"
                    ? "Aktivt"
                    : item.status === "accepted"
                      ? "Accepterat"
                      : "Avslutat"}
                </p>
                {item.status === "active" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={pending === item.id} onClick={() => void accept(item)} className={primaryButtonClassName}>Acceptera bud</button>
                    <StartChatButton bidId={item.id} canStart />
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-[var(--muted)]">Inga bud ännu.</p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-semibold">Frågor</h2>
        <div className="mt-4 space-y-3">
          {questions.length ? (
            questions.map((question) => (
              <article
                key={question.id}
                className="rounded-xl border border-[var(--border)] p-4"
              >
                <p className="text-sm font-semibold">{question.authorLabel}</p>
                <p className="mt-1">{question.body}</p>
                {question.answerBody ? (
                  <p className="mt-3 border-l-2 border-[var(--primary)] pl-3">
                    <strong>Ditt svar:</strong> {question.answerBody}
                  </p>
                ) : (
                  <form
                    onSubmit={(event) => void answer(event, question)}
                    className="mt-3 space-y-2"
                  >
                    <textarea
                      name="body"
                      required
                      maxLength={1000}
                      rows={2}
                      className={`${inputClassName} resize-y`}
                      placeholder="Svara offentligt"
                    />
                    <button
                      disabled={pending === question.id}
                      className={primaryButtonClassName}
                    >
                      Publicera svar
                    </button>
                  </form>
                )}
              </article>
            ))
          ) : (
            <p className="text-[var(--muted)]">Inga frågor ännu.</p>
          )}
        </div>
      </section>
    </div>
  );
}
