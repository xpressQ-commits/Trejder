"use client";

import Image from "next/image";
import Link from "next/link";
import { CarFront, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceListingSummary, MarketplacePage } from "./types";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { formatDate } from "@/i18n";

type VatFilter = "all" | "yes" | "no";

export function MarketplaceFeed({
  initialPage,
}: {
  initialPage: MarketplacePage;
}) {
  const { t, locale } = usePreferences();
  const [query, setQuery] = useState("");
  const [vat, setVat] = useState<VatFilter>("all");
  const [listings, setListings] = useState<MarketplaceListingSummary[]>(
    initialPage.listings,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPage.nextCursor,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const firstRender = useRef(true);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (vat !== "all") params.set("vat", vat);
      if (cursor) params.set("cursor", cursor);
      try {
        const response = await fetch(`/api/marketplace?${params}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const page = (await response.json()) as MarketplacePage;
        setListings((current) =>
          cursor ? [...current, ...page.listings] : page.listings,
        );
        setNextCursor(page.nextCursor);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [query, vat],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-[var(--success)]">
          {t("market.description")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t("market.title")}
        </h1>
      </header>
      <div className="mt-7 grid gap-3 border-y border-[var(--border)] py-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <label className="relative block">
          <span className="sr-only">{t("market.search")}</span>
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
            size={18}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pr-3 pl-10"
            placeholder={t("market.search")}
          />
        </label>
        <label>
          <span className="sr-only">{t("market.vatFilter")}</span>
          <select
            value={vat}
            onChange={(event) => setVat(event.target.value as VatFilter)}
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="all">{t("market.allVat")}</option>
            <option value="yes">{t("market.vatYes")}</option>
            <option value="no">{t("market.vatNo")}</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {t("market.sortNewest")}
      </p>
      {error ? (
        <p role="alert" className="py-10 text-[var(--danger)]">
          {t("market.error")}
        </p>
      ) : listings.length === 0 && !loading ? (
        <div className="py-16 text-center">
          <CarFront
            aria-hidden="true"
            className="mx-auto text-[var(--muted)]"
          />
          <p className="mt-3 font-semibold">{t("market.empty")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t("market.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <MarketplaceCard
              key={listing.id}
              listing={listing}
              locale={locale}
              vatYes={t("market.vatYes")}
              vatNo={t("market.vatNo")}
            />
          ))}
        </ul>
      )}
      {loading ? (
        <p
          role="status"
          className="py-8 text-center text-sm text-[var(--muted)]"
        >
          {t("market.loading")}
        </p>
      ) : nextCursor ? (
        <div className="pt-8 text-center">
          <button
            type="button"
            onClick={() => void load(nextCursor)}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 font-semibold hover:bg-[var(--surface-subtle)]"
          >
            {t("market.loadMore")}
          </button>
        </div>
      ) : null}
    </>
  );
}

function MarketplaceCard({
  listing,
  locale,
  vatYes,
  vatNo,
}: {
  listing: MarketplaceListingSummary;
  locale: "sv" | "en";
  vatYes: string;
  vatNo: string;
}) {
  const image = [...listing.images].sort((a, b) => a.position - b.position)[0];
  return (
    <li className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <Link href={`/app/marknad/${listing.id}`} className="group block">
        <div className="relative aspect-[16/9] bg-[var(--surface-subtle)]">
          {image ? (
            <Image
              src={`${image.url}?width=640`}
              alt=""
              fill
              unoptimized
              loading="lazy"
              sizes="(min-width: 1280px) 22rem, (min-width: 768px) 45vw, 100vw"
              className="object-contain p-1 transition-transform group-hover:scale-[1.01]"
            />
          ) : null}
        </div>
        <div className="p-4">
          <h2 className="text-lg font-semibold tracking-tight">
            {listing.identifier.value}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {listing.modelYear ? `${listing.modelYear} · ` : ""}
            {formatMileage(listing.mileageMil, locale)} mil
          </p>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm">
            {listing.shortComment}
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs">
            <span className="font-medium">
              {listing.deductibleVat ? vatYes : vatNo}
            </span>
            <time
              className="text-[var(--muted)]"
              dateTime={listing.publishedAt}
            >
              {formatPublished(listing.publishedAt, locale)}
            </time>
          </div>
        </div>
      </Link>
    </li>
  );
}

export const formatMileage = (mileage: number, locale: "sv" | "en" = "sv") =>
  new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-US").format(mileage);
export function formatPublished(value: string, locale: "sv" | "en" = "sv") {
  return formatDate(locale, value, { dateStyle: "medium", timeStyle: "short" });
}
