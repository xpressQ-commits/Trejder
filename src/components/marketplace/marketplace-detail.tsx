"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatMileage, formatPublished } from "./marketplace-feed";
import type { MarketplaceListingSummary } from "./types";
import { MarketplaceInteractions } from "@/components/marketplace/marketplace-interactions";
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery";

export function MarketplaceDetail({
  listing,
  canBid,
}: {
  listing: MarketplaceListingSummary;
  canBid: boolean;
}) {
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
      <div className="mt-5">
        <VehicleGallery images={images} label={listing.identifier.value} />
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
            {listing.modelYear ? `${listing.modelYear} · ` : ""}
            {formatMileage(listing.mileageMil)} mil
          </p>
          <p className="mt-7 max-w-2xl whitespace-pre-wrap">
            {listing.shortComment}
          </p>
          <div className="mt-7">
            {listing.isOwnListing ? (
              <Link
                href={`/app/bilar/${listing.id}`}
                className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold hover:bg-[var(--surface-subtle)]"
              >
                Hantera min annons
              </Link>
            ) : null}
          </div>
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
      {!listing.isOwnListing ? (
        <MarketplaceInteractions listingId={listing.id} canBid={canBid} />
      ) : null}
    </article>
  );
}
