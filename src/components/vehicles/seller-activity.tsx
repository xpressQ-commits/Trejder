"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  FormMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-controls";
import { StartChatButton } from "@/components/chat/start-chat-button";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { formatDate, formatMoney } from "@/i18n";

type Bid = {
  id: string;
  amountOre: number;
  status: string;
  bidderLabel: string;
  createdAt: string;
  updatedAt: string;
};
type Question = {
  id: string;
  body: string;
  answerBody: string | null;
  authorLabel: string;
};
type SellerBidOverview = {
  bids: Bid[];
  acceptedBid: Bid | null;
  totalActiveBidders: number;
};

export function SellerActivity({
  listingId,
  canMutate,
  dealId,
}: {
  listingId: string;
  canMutate: boolean;
  dealId?: string;
}) {
  const { t, locale } = usePreferences();
  const router = useRouter();
  const [overview, setOverview] = useState<SellerBidOverview>({
    bids: [],
    acceptedBid: null,
    totalActiveBidders: 0,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();
  const [pending, setPending] = useState<string>();
  const load = useCallback(async () => {
    const [b, q] = await Promise.all([
      fetch(`/api/company/listings/${listingId}/bids`, { cache: "no-store" }),
      fetch(`/api/company/listings/${listingId}/questions`, {
        cache: "no-store",
      }),
    ]);
    if (b.ok) setOverview((await b.json()) as SellerBidOverview);
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
      if (b.ok) setOverview((await b.json()) as SellerBidOverview);
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
        `${t("bids.acceptConfirm")} ${item.bidderLabel} (${formatMoney(locale, item.amountOre)})?`,
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
    setMessage({
      type: response.ok ? "success" : "error",
      text: response.ok ? t("bids.accepted") : t("bids.acceptError"),
    });
    await load();
    if (response.ok) router.refresh();
    setPending(undefined);
  }

  async function reject(item: Bid) {
    if (
      !window.confirm(
        `${t("bids.rejectConfirm")} ${item.bidderLabel} (${formatMoney(locale, item.amountOre)})?`,
      )
    )
      return;
    setPending(item.id);
    const response = await fetch(
      `/api/company/listings/${listingId}/bids/${item.id}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionConfirmed: true }),
      },
    );
    setMessage({
      type: response.ok ? "success" : "error",
      text: response.ok ? t("bids.rejected") : t("bids.rejectError"),
    });
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
    setMessage({
      type: response.ok ? "success" : "error",
      text: response.ok
        ? t("questions.answerSaved")
        : t("questions.answerError"),
    });
    await load();
    setPending(undefined);
  }

  const displayedBids = overview.acceptedBid
    ? [overview.acceptedBid]
    : overview.bids;
  return (
    <div className="space-y-6">
      {message ? (
        <FormMessage type={message.type}>{message.text}</FormMessage>
      ) : null}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{t("bids.title")}</h2>
            {!overview.acceptedBid ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {overview.totalActiveBidders} {t("bids.totalBidders")}
              </p>
            ) : null}
          </div>
          {overview.totalActiveBidders > 3 ? (
            <span className="text-xs text-[var(--muted)]">
              {t("bids.topThree")}
            </span>
          ) : null}
        </div>
        {overview.acceptedBid ? (
          <div className="mt-4 rounded-xl border border-[var(--success)] bg-[var(--success-surface)] p-4">
            <p className="font-semibold">{t("bids.accepted")}</p>
            <p className="mt-1">
              {overview.acceptedBid.bidderLabel} ·{" "}
              {formatMoney(locale, overview.acceptedBid.amountOre)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {dealId ? (
                <Link
                  href={`/app/affarer/${dealId}`}
                  className={primaryButtonClassName}
                >
                  {t("deals.openDeal")}
                </Link>
              ) : null}
              <StartChatButton bidId={overview.acceptedBid.id} canStart />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {displayedBids.length ? (
              displayedBids.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-[var(--border)] p-4"
                >
                  <p className="font-semibold">{item.bidderLabel}</p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatMoney(locale, item.amountOre)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {t("bids.bidReceived")}{" "}
                    {formatDate(locale, item.createdAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {canMutate ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending === item.id}
                        onClick={() => void accept(item)}
                        className={primaryButtonClassName}
                      >
                        {t("bids.accept")}
                      </button>
                      <button
                        type="button"
                        disabled={pending === item.id}
                        onClick={() => void reject(item)}
                        className={secondaryButtonClassName}
                      >
                        {t("bids.reject")}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-[var(--muted)]">{t("bids.none")}</p>
            )}
          </div>
        )}
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-semibold">{t("questions.title")}</h2>
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
                    <strong>{t("questions.yourAnswer")}</strong>{" "}
                    {question.answerBody}
                  </p>
                ) : canMutate ? (
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
                      placeholder={t("questions.answerPlaceholder")}
                    />
                    <button
                      disabled={pending === question.id}
                      className={primaryButtonClassName}
                    >
                      {t("questions.publishAnswer")}
                    </button>
                  </form>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("questions.waiting")}
                  </p>
                )}
              </article>
            ))
          ) : (
            <p className="text-[var(--muted)]">{t("questions.none")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
