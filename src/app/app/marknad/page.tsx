import { MarketplaceFeed } from "@/components/marketplace/marketplace-feed";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { listMarketplaceListings } from "@/server/marketplace/listings";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const context = await getCurrentCompanyContext();
  const page = await listMarketplaceListings({ activeCompanyId: context.company.id });
  return <MarketplaceFeed initialPage={{
    listings: page.listings.map((listing) => ({ ...listing, publishedAt: listing.publishedAt.toISOString() })),
    nextCursor: page.nextCursor,
  }} />;
}
