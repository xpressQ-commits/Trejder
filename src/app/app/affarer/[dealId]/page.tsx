import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { ChatCenter } from "@/components/chat/chat-center";
import { DealCompletionAction } from "@/components/deals/deal-completion-action";
import { createOrGetChatThread } from "@/server/chat";
import { getCompanyDeal } from "@/server/deals";
import { formatDate, formatMoney } from "@/i18n";
import { getTranslations } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const context = await getCurrentCompanyContext();
  const { locale, t } = await getTranslations();
  let deal;
  try {
    deal = await getCompanyDeal(context.company.id, (await params).dealId);
  } catch {
    notFound();
  }
  const chat = await createOrGetChatThread({
    bidId: deal.acceptedBidId,
    actorCompanyId: context.company.id,
    actorUserId: context.user.id,
  });
  return (
    <article>
      <Link
        href="/app/affarer"
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--primary)]"
      >
        <ArrowLeft size={18} /> {t("deals.back")}
      </Link>
      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:grid lg:grid-cols-[18rem_1fr]">
        <div className="relative aspect-video bg-[var(--surface-subtle)] lg:aspect-auto">
          <Image
            src={`${deal.imageUrl}?width=720`}
            alt={deal.listingLabel}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--primary)]">
                {t("deals.detailEyebrow")}
              </p>
              <h1 className="mt-1 text-3xl font-semibold">
                {deal.listingLabel}
              </h1>
              <p className="mt-2 text-[var(--muted)]">
                {deal.modelYear ? `${deal.modelYear} · ` : ""}
                {new Intl.NumberFormat(locale).format(deal.mileageMil)} mil
              </p>
            </div>
            <span className="rounded-full bg-[var(--success-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--success)]">
              {deal.status === "completed"
                ? t("deals.completedStatus")
                : t("deals.activeStatus")}
            </span>
          </div>
          <dl className="mt-6 grid gap-5 border-t border-[var(--border)] pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-[var(--muted)]">
                {t("deals.acceptedPrice")}
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatMoney(locale, deal.amountOre)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted)]">
                {t("deals.yourRole")}
              </dt>
              <dd className="mt-1 font-semibold">
                {deal.viewerIsSeller ? t("deals.seller") : t("deals.buyer")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--muted)]">
                {t("deals.acceptedAt")}
              </dt>
              <dd className="mt-1 font-semibold">
                {formatDate(locale, deal.acceptedAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-semibold">{t("deals.partner")}</h2>
          <p className="mt-4 font-semibold">{deal.counterparty.name}</p>
          <p className="text-sm text-[var(--muted)]">
            {deal.counterparty.contactName}
          </p>
          <div className="mt-4 space-y-2">
            <a
              href={`mailto:${deal.counterparty.email}`}
              className="flex items-center gap-2 text-[var(--primary)] underline"
            >
              <Mail size={17} />
              {deal.counterparty.email}
            </a>
            {deal.counterparty.phone ? (
              <a
                href={`tel:${deal.counterparty.phone}`}
                className="flex items-center gap-2 text-[var(--primary)] underline"
              >
                <Phone size={17} />
                {deal.counterparty.phone}
              </a>
            ) : null}
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-semibold">{t("deals.process")}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("deals.completionHint")}
          </p>
          <div className="mt-5">
            <DealCompletionAction
              dealId={deal.id}
              alreadyConfirmed={Boolean(deal.viewerCompletedAt)}
              completed={deal.status === "completed"}
            />
          </div>
        </section>
      </div>
      <div className="mt-8">
        <ChatCenter
          initialThreads={[
            { ...chat.thread, updatedAt: chat.thread.updatedAt.toISOString() },
          ]}
          initialThreadId={chat.thread.id}
          canSend={context.membership.role !== "viewer"}
        />
      </div>
    </article>
  );
}
