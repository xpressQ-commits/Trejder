import { notFound } from "next/navigation";
import { VehicleListingForm } from "@/components/vehicles/vehicle-listing-form";
import { serializeOwnListing } from "@/components/vehicles/types";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { getOwnListing } from "@/server/vehicles/listings";

export default async function VehicleDetailPage({ params }: { params: Promise<{ listingId: string }> }) {
  const context = await getCurrentCompanyContext();
  let listing;
  try {
    listing = serializeOwnListing(await getOwnListing(context.company.id, (await params).listingId));
  } catch {
    notFound();
  }
  const description = listing.status === "active"
    ? "Publicerad bil. Reg/modell, miltal och moms är låsta."
    : listing.status === "draft"
      ? "Utkast — publicering kräver exakt tre bilder."
      : "Avslutad bil — kan inte återaktiveras.";
  return <section aria-labelledby="vehicle-title"><p className="text-sm font-semibold text-[var(--primary)]">Egen bil</p><h1 id="vehicle-title" className="mt-1 text-3xl font-semibold tracking-tight">{listing.identifier.value}</h1><p className="mt-3 text-[var(--muted)]">{description}</p><div className="mt-7"><VehicleListingForm listing={listing} canMutate={context.membership.role !== "viewer"} /></div></section>;
}
