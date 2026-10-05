import Link from "next/link";
import { Pencil } from "lucide-react";
import { VehicleGallery } from "./vehicle-gallery";
import { SellerActivity } from "./seller-activity";
import { Status } from "./own-listings";
import type { OwnListing } from "./types";
import { EquipmentList } from "./equipment-list";

export function SellerListingDetail({
  listing,
  canMutate,
}: {
  listing: OwnListing;
  canMutate: boolean;
}) {
  return (
    <article>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--primary)]">
            Egen annons
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {listing.identifier.value}
            </h1>
            <Status status={listing.status} />
          </div>
          <p className="mt-2 text-[var(--muted)]">
            {listing.modelYear ? `${listing.modelYear} · ` : ""}
            {new Intl.NumberFormat("sv-SE").format(listing.mileageMil)} mil
          </p>
        </div>
        {canMutate &&
        listing.status !== "withdrawn" &&
        listing.status !== "matched" ? (
          <Link
            href={`/app/bilar/${listing.id}/redigera`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold hover:bg-[var(--surface-subtle)]"
          >
            <Pencil size={17} />
            Redigera annons
          </Link>
        ) : null}
      </div>
      <div className="mt-6">
        <VehicleGallery
          images={listing.images}
          label={listing.identifier.value}
        />
      </div>
      <div className="mt-7 grid gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-semibold">Beskrivning</h2>
          <p className="mt-2 max-w-2xl whitespace-pre-wrap">
            {listing.shortComment}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-5 text-sm md:grid-cols-1">
          <div>
            <dt className="text-[var(--muted)]">Moms</dt>
            <dd className="font-semibold">
              {listing.deductibleVat ? "Avdragbar" : "Ej avdragbar"}
            </dd>
          </div>
          {listing.expiresAt ? (
            <div>
              <dt className="text-[var(--muted)]">Publicerad till</dt>
              <dd className="font-semibold">
                {new Intl.DateTimeFormat("sv-SE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(listing.expiresAt))}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      <EquipmentList
        equipment={listing.equipment}
        otherEquipment={listing.otherEquipment}
      />
      {listing.status !== "draft" ? (
        <SellerActivity listingId={listing.id} />
      ) : null}
    </article>
  );
}
