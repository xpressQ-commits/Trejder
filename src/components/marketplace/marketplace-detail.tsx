"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { formatMileage, formatPublished } from "./marketplace-feed";
import type { MarketplaceListingSummary } from "./types";

export function MarketplaceDetail({ listingId }: { listingId: string }) {
  const [listing, setListing] = useState<MarketplaceListingSummary | null>(
    null,
  );
  const [notAvailable, setNotAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/marketplace/${encodeURIComponent(listingId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = (await response.json()) as {
          listing: MarketplaceListingSummary;
        };
        if (active) setListing(body.listing);
      })
      .catch(() => {
        if (active) setNotAvailable(true);
      });
    return () => {
      active = false;
    };
  }, [listingId]);

  if (notAvailable)
    return (
      <section>
        <Link
          href="/app/marknad"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--primary)]"
        >
          <ArrowLeft size={18} />
          Till marknaden
        </Link>
        <h1 className="mt-8 text-2xl font-semibold">
          Bilen är inte tillgänglig
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Den kan ha tagits bort från marknaden.
        </p>
      </section>
    );
  if (!listing)
    return (
      <p role="status" className="py-10 text-[var(--muted)]">
        Hämtar bil…
      </p>
    );
  const images = [...listing.images].sort((a, b) => a.position - b.position);
  return (
    <article>
      <Link
        href="/app/marknad"
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--primary)]"
      >
        <ArrowLeft aria-hidden="true" size={18} />
        Till marknaden
      </Link>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-100 sm:row-span-2 sm:aspect-auto">
          {images[0] ? (
            <Image
              src={images[0].url}
              alt="Bild 1 av bilen"
              fill
              unoptimized
              priority
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : null}
        </div>
        {images.slice(1).map((image) => (
          <div
            key={image.position}
            className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-100"
          >
            <Image
              src={image.url}
              alt={`Bild ${image.position} av bilen`}
              fill
              unoptimized
              sizes="(min-width: 640px) 25vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-8 border-t border-[var(--border)] pt-7 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div>
          <p className="text-sm font-semibold text-[var(--success)]">
            Bil på marknaden
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {listing.identifier.value}
          </h1>
          <p className="mt-2 text-lg text-[var(--muted)]">
            {formatMileage(listing.mileageMil)} mil
          </p>
          <p className="mt-7 max-w-2xl whitespace-pre-wrap">
            {listing.shortComment}
          </p>
        </div>
        <dl className="space-y-5 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Moms</dt>
            <dd className="mt-1 font-semibold">
              {listing.deductibleVat ? "Avdragbar moms" : "Ej avdragbar moms"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Publicerad</dt>
            <dd className="mt-1 font-semibold">
              <time dateTime={listing.publishedAt}>
                {formatPublished(listing.publishedAt).replace(
                  "Publicerad ",
                  "",
                )}
              </time>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
