import { notFound } from "next/navigation";
import { serializeOwnListing } from "@/components/vehicles/types";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { getOwnListing } from "@/server/vehicles/listings";
import { SellerListingDetail } from "@/components/vehicles/seller-listing-detail";

export default async function VehicleDetailPage({
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
  return (
    <SellerListingDetail
      listing={listing}
      canMutate={context.membership.role !== "viewer"}
    />
  );
}
