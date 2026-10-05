import { notFound } from "next/navigation";
import { VehicleListingForm } from "@/components/vehicles/vehicle-listing-form";
import { serializeOwnListing } from "@/components/vehicles/types";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { getOwnListing } from "@/server/vehicles/listings";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const context = await getCurrentCompanyContext();
  let listing;
  try {
    listing = serializeOwnListing(
      await getOwnListing(context.company.id, (await params).listingId),
    );
  } catch {
    notFound();
  }
  if (listing.status === "withdrawn" || listing.status === "matched")
    notFound();
  return (
    <section>
      <p className="text-sm font-semibold text-[var(--primary)]">
        Redigera annons
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {listing.identifier.value}
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Spara ändringarna och återgå sedan till annonsens detaljsida.
      </p>
      <div className="mt-7">
        <VehicleListingForm
          listing={listing}
          canMutate={context.membership.role !== "viewer"}
        />
      </div>
    </section>
  );
}
