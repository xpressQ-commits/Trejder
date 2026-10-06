"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StartChatButton } from "@/components/chat/start-chat-button";
import {
  FormMessage,
  inputClassName,
  primaryButtonClassName,
} from "@/components/ui/form-controls";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { formatMoney } from "@/i18n";

type Question = {
  id: string;
  body: string;
  answerBody: string | null;
  authorLabel: string;
  answerAuthorLabel: string | null;
  createdAt: string;
};
type Bid = { id: string; amountOre: number; status: string };
export function MarketplaceInteractions({
  listingId,
  canBid,
  hasSubscriptionAccess,
}: {
  listingId: string;
  canBid: boolean;
  hasSubscriptionAccess: boolean;
}) {
  const { t, locale } = usePreferences();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [ownBid, setOwnBid] = useState<Bid | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();
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
    const responseBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (
      response.status === 403 &&
      responseBody?.error === "SUBSCRIPTION_REQUIRED"
    ) {
      router.push("/app/installningar?billing=required");
      return;
    }
    setMessage({
      type: response.ok ? "success" : "error",
      text: response.ok ? t("bids.saved") : t("bids.error"),
    });
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
    setMessage({
      type: response.ok ? "success" : "error",
      text: response.ok ? t("questions.saved") : t("questions.error"),
    });
    if (response.ok) form.reset();
    await load();
    setPending(false);
  }
  return (
    <div className="mt-9 space-y-8 border-t border-[var(--border)] pt-8">
      {message ? (
        <FormMessage type={message.type}>{message.text}</FormMessage>
      ) : null}
      {canBid && hasSubscriptionAccess ? (
        <section>
          <h2 className="text-xl font-semibold">{t("bids.place")}</h2>
          {ownBid ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t("bids.current")}:{" "}
              <strong className="text-[var(--foreground)]">
                {formatMoney(locale, ownBid.amountOre)}
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
              aria-label={t("bids.amountPlaceholder")}
              placeholder={t("bids.amountPlaceholder")}
              className={inputClassName}
            />
            <button disabled={pending} className={primaryButtonClassName}>
              {ownBid ? t("bids.update") : t("bids.place")}
            </button>
          </form>
          {ownBid?.status === "accepted" ? (
            <div className="mt-4">
              <StartChatButton bidId={ownBid.id} canStart />
            </div>
          ) : null}
        </section>
      ) : canBid ? (
        <section className="rounded-2xl border border-[var(--warning)] bg-[var(--warning-surface)] p-5">
          <h2 className="text-xl font-semibold">
            Premium krävs för att lägga bud
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Du kan fortsätta se hela marknaden. Aktivera eller förnya företagets
            abonnemang för att lägga bud och ställa frågor.
          </p>
          <Link
            href="/app/installningar?billing=required"
            className={`${primaryButtonClassName} mt-4 inline-flex`}
          >
            Gå till abonnemang
          </Link>
        </section>
      ) : null}
      <section>
        <h2 className="text-xl font-semibold">{t("questions.title")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t("questions.publicHint")}
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
                  <p className="text-sm font-semibold">
                    {t("questions.seller")}
                  </p>
                  <p>{question.answerBody}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {t("questions.waiting")}
                </p>
              )}
            </article>
          ))}
        </div>
        {canBid && hasSubscriptionAccess ? (
          <form onSubmit={ask} className="mt-4 max-w-xl space-y-3">
            <textarea
              name="body"
              required
              maxLength={1000}
              rows={3}
              placeholder={t("questions.askPlaceholder")}
              className={`${inputClassName} resize-y`}
            />
            <button disabled={pending} className={primaryButtonClassName}>
              {t("questions.publish")}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
