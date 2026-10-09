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
import { formatDate, formatMoney } from "@/i18n";

type Question = {
  id: string;
  body: string;
  answerBody: string | null;
  authorLabel: string;
  answerAuthorLabel: string | null;
  createdAt: string;
};
type Bid = { id: string; amountOre: number; status: string };
type PublicBidActivity = {
  bidderCount: number;
  activity: Array<{ anonymousLabel: string; createdAt: string }>;
};

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
  const [publicActivity, setPublicActivity] = useState<PublicBidActivity>({
    bidderCount: 0,
    activity: [],
  });
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
    if (b.ok) {
      const result = (await b.json()) as {
        bid: Bid | null;
        publicActivity: PublicBidActivity;
      };
      setOwnBid(result.bid);
      setPublicActivity(result.publicActivity);
    }
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
      if (b.ok) {
        const result = (await b.json()) as {
          bid: Bid | null;
          publicActivity: PublicBidActivity;
        };
        setOwnBid(result.bid);
        setPublicActivity(result.publicActivity);
      }
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
    const response = await fetch(`/api/marketplace/${listingId}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountOre: Math.round(Number(data.get("amount")) * 100),
      }),
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
    <div className="space-y-6">
      {message ? (
        <FormMessage type={message.type}>{message.text}</FormMessage>
      ) : null}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-semibold">{t("bids.bidders")}</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--primary)]">
          {publicActivity.bidderCount} {t("bids.totalBidders")}
        </p>
        <div className="mt-4 space-y-3">
          {publicActivity.activity.length ? (
            publicActivity.activity.map((item, index) => (
              <div
                key={`${item.anonymousLabel}-${item.createdAt}-${index}`}
                className="rounded-xl border border-[var(--border)] p-3"
              >
                <p className="font-semibold">{item.anonymousLabel}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {t("bids.bidReceived")}{" "}
                  {formatDate(locale, item.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">{t("bids.none")}</p>
          )}
        </div>
        {canBid && hasSubscriptionAccess ? (
          <div className="mt-5 border-t border-[var(--border)] pt-5">
            <h3 className="font-semibold">{t("bids.place")}</h3>
            {ownBid ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {t("bids.current")}:{" "}
                <strong className="text-[var(--foreground)]">
                  {formatMoney(locale, ownBid.amountOre)}
                </strong>
              </p>
            ) : null}
            <form
              onSubmit={bid}
              className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"
            >
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
          </div>
        ) : canBid ? (
          <div className="mt-5 border-t border-[var(--border)] pt-5">
            <p className="font-semibold">Premium krävs för att lägga bud</p>
            <Link
              href="/app/installningar?billing=required"
              className={`${primaryButtonClassName} mt-3 inline-flex`}
            >
              Gå till abonnemang
            </Link>
          </div>
        ) : null}
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
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
          <form onSubmit={ask} className="mt-4 space-y-3">
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
