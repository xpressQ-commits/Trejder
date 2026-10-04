import { OwnListings } from "@/components/vehicles/own-listings";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { serializeOwnListing } from "@/components/vehicles/types";
import { listOwnListings } from "@/server/vehicles/listings";

export const dynamic = "force-dynamic";

export default async function OwnVehiclesPage() {
  const context = await getCurrentCompanyContext();
  const listings = await listOwnListings(context.company.id);
  return <OwnListings canMutate={context.membership.role !== "viewer"} initialListings={listings.map(serializeOwnListing)} />;
}
