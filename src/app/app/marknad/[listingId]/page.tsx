import { MarketplaceDetail } from "@/components/marketplace/marketplace-detail";
import { getCurrentDealerContext } from "@/app/app/_lib/current-context";
import { getMarketplaceListing } from "@/server/marketplace/listings";
import { notFound } from "next/navigation";
import { getCompanySubscriptionAccess } from "@/server/billing";

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const context = await getCurrentDealerContext();
  const subscription = await getCompanySubscriptionAccess(context.company.id);
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
        expiresAt: listing.expiresAt?.toISOString() ?? null,
      }}
      canBid={context.membership.role !== "viewer"}
      hasSubscriptionAccess={subscription.canAccess}
    />
  );
}
