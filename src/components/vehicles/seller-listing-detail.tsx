import Link from "next/link";
import { Handshake, Pencil } from "lucide-react";
import { VehicleGallery } from "./vehicle-gallery";
import { SellerActivity } from "./seller-activity";
import { Status } from "./own-listings";
import type { OwnListing } from "./types";
import { EquipmentList } from "./equipment-list";

export function SellerListingDetail({
  listing,
  canMutate,
  dealId,
}: {
  listing: OwnListing;
  canMutate: boolean;
  dealId?: string;
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
            {new Intl.NumberFormat("sv-SE").format(listing.mileageMil)} mil ·{" "}
            {listing.deductibleVat ? "Avdragbar moms" : "Ej avdragbar moms"}
          </p>
        </div>
        {dealId ? (
          <Link
            href={`/app/affarer/${dealId}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 font-semibold text-white hover:opacity-90"
          >
            <Handshake size={17} />
            Öppna affär
          </Link>
        ) : canMutate &&
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
      <div
        className={`mt-6 ${listing.status === "draft" ? "" : "grid items-start gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]"}`}
      >
        <VehicleGallery
          images={listing.images}
          label={listing.identifier.value}
        />
        {listing.status !== "draft" ? (
          <SellerActivity
            listingId={listing.id}
            canMutate={canMutate}
            dealId={dealId}
          />
        ) : null}
      </div>
      <div className="mt-8 grid gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-semibold">Beskrivning</h2>
          <p className="mt-2 max-w-2xl whitespace-pre-wrap">
            {listing.shortComment}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-5 text-sm md:grid-cols-1">
          {listing.expiresAt ? (
            <div>
              <dt className="text-[var(--muted)]">
                {listing.status === "inactive" ? "Löpte ut" : "Publicerad till"}
              </dt>
              <dd className="font-semibold">
                {new Intl.DateTimeFormat("sv-SE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(listing.expiresAt))}
              </dd>
            </div>
          ) : listing.status === "active" ? (
            <div>
              <dt className="text-[var(--muted)]">Publicerad till</dt>
              <dd className="font-semibold">Obegränsad</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <EquipmentList
        equipment={listing.equipment}
        otherEquipment={listing.otherEquipment}
      />
    </article>
  );
}
