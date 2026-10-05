import { MarketplaceDetail } from "@/components/marketplace/marketplace-detail";
import { getCurrentDealerContext } from "@/app/app/_lib/current-context";
import { getMarketplaceListing } from "@/server/marketplace/listings";
import { notFound } from "next/navigation";

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const context = await getCurrentDealerContext();
  let listing;
  try {
    listing = await getMarketplaceListing(
      context.company.id,
      (await params).listingId,
    );
  } catch {
    notFound();
  }
  return (
    <MarketplaceDetail
      listing={{
        ...listing,
        publishedAt: listing.publishedAt.toISOString(),
        expiresAt: listing.expiresAt.toISOString(),
      }}
      canBid={context.membership.role !== "viewer"}
    />
  );
}
