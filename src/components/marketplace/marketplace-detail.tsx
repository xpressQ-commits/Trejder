"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatMileage, formatPublished } from "./marketplace-feed";
import type { MarketplaceListingSummary } from "./types";
import { MarketplaceInteractions } from "@/components/marketplace/marketplace-interactions";
import { SellerActivity } from "@/components/vehicles/seller-activity";
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery";
import { EquipmentList } from "@/components/vehicles/equipment-list";

export function MarketplaceDetail({
  listing,
  canBid,
  hasSubscriptionAccess,
}: {
  listing: MarketplaceListingSummary;
  canBid: boolean;
  hasSubscriptionAccess: boolean;
}) {
  const images = [...listing.images].sort((a, b) => a.position - b.position);
  return (
    <article>
      <Link
        href="/app/marknad"
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--primary)]"
      >
        <ArrowLeft aria-hidden="true" size={18} /> Till marknaden
      </Link>
      <header className="mt-4">
        <p className="text-sm font-semibold text-[var(--success)]">
          Bil på marknaden
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {listing.identifier.value}
        </h1>
        <p className="mt-2 text-lg text-[var(--muted)]">
          {listing.modelYear ? `${listing.modelYear} · ` : ""}
          {formatMileage(listing.mileageMil)} mil ·{" "}
          {listing.deductibleVat ? "Avdragbar moms" : "Ej avdragbar moms"}
        </p>
      </header>
      <div className="mt-6 grid items-start gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <VehicleGallery images={images} label={listing.identifier.value} />
        {listing.isOwnListing ? (
          <SellerActivity listingId={listing.id} canMutate={canBid} />
        ) : (
          <MarketplaceInteractions
            listingId={listing.id}
            canBid={canBid}
            hasSubscriptionAccess={hasSubscriptionAccess}
          />
        )}
      </div>
      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h2 className="font-semibold">Beskrivning</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap">
              {listing.shortComment}
            </p>
          </div>
          <dl className="text-sm">
            <dt className="text-[var(--muted)]">Publicerad</dt>
            <dd className="mt-1 font-semibold">
              <time dateTime={listing.publishedAt}>
                {formatPublished(listing.publishedAt).replace(
                  "Publicerad ",
                  "",
                )}
              </time>
            </dd>
          </dl>
        </div>
        {listing.isOwnListing ? (
          <Link
            href={`/app/bilar/${listing.id}`}
            className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold hover:bg-[var(--surface-subtle)]"
          >
            Hantera min annons
          </Link>
        ) : null}
      </section>
      <EquipmentList
        equipment={listing.equipment}
        otherEquipment={listing.otherEquipment}
      />
    </article>
  );
}
