import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Handshake } from "lucide-react";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { listCompanyDeals } from "@/server/deals";
import { formatDate, formatMoney } from "@/i18n";
import { getTranslations } from "@/i18n/server";

export default async function DealsPage() {
  const context = await getCurrentCompanyContext();
  const { t, locale } = await getTranslations();
  const deals = await listCompanyDeals(context.company.id);
  const active = deals.filter((deal) => deal.status !== "completed");
  const completed = deals.filter((deal) => deal.status === "completed");

  return (
    <section>
      <p className="text-sm font-semibold text-[var(--primary)]">
        {t("deals.eyebrow")}
      </p>
      <h1 className="mt-1 text-3xl font-semibold">{t("deals.title")}</h1>
      {deals.length ? (
        <div className="mt-8 space-y-10">
          <DealGroup
            title={t("deals.active")}
            deals={active}
            locale={locale}
            labels={{
              completed: t("deals.completedStatus"),
              active: t("deals.activeStatus"),
              seller: t("deals.seller"),
              buyer: t("deals.buyer"),
              accepted: t("deals.acceptedLabel"),
              open: t("deals.openDeal"),
              empty: t("deals.noneInSection"),
            }}
          />
          <DealGroup
            title={t("deals.completed")}
            deals={completed}
            locale={locale}
            labels={{
              completed: t("deals.completedStatus"),
              active: t("deals.activeStatus"),
              seller: t("deals.seller"),
              buyer: t("deals.buyer"),
              accepted: t("deals.acceptedLabel"),
              open: t("deals.openDeal"),
              empty: t("deals.noneInSection"),
            }}
          />
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <Handshake className="mx-auto text-[var(--muted)]" size={32} />
          <h2 className="mt-3 text-lg font-semibold">{t("deals.noDeals")}</h2>
          <p className="mt-1 text-[var(--muted)]">{t("deals.noDealsHint")}</p>
        </div>
      )}
    </section>
  );
}

type Deal = Awaited<ReturnType<typeof listCompanyDeals>>[number];

function DealGroup({
  title,
  deals,
  locale,
  labels,
}: {
  title: string;
  deals: Deal[];
  locale: "sv" | "en";
  labels: {
    completed: string;
    active: string;
    seller: string;
    buyer: string;
    accepted: string;
    open: string;
    empty: string;
  };
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {deals.length ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {deals.map((deal) => (
            <article
              key={deal.id}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] sm:grid sm:grid-cols-[9rem_1fr]"
            >
              <div className="relative aspect-video bg-[var(--surface-subtle)] sm:aspect-auto">
                <Image
                  src={`${deal.imageUrl}?width=480`}
                  alt={deal.listingLabel}
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{deal.listingLabel}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {deal.modelYear ? `${deal.modelYear} · ` : ""}
                      {new Intl.NumberFormat(locale).format(
                        deal.mileageMil,
                      )}{" "}
                      mil
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--success-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                    {deal.status === "completed"
                      ? labels.completed
                      : labels.active}
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold">
                  {formatMoney(locale, deal.amountOre)}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {deal.viewerIsSeller ? labels.seller : labels.buyer} ·{" "}
                  {labels.accepted}{" "}
                  {formatDate(locale, deal.acceptedAt, { dateStyle: "medium" })}
                </p>
                <Link
                  href={`/app/affarer/${deal.id}`}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--primary)]"
                >
                  {labels.open} <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">{labels.empty}</p>
      )}
    </section>
  );
}
