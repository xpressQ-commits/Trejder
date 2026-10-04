import { MarketplaceDetail } from "@/components/marketplace/marketplace-detail";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";

export default async function MarketplaceListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const context = await getCurrentCompanyContext();
  return <MarketplaceDetail listingId={(await params).listingId} canStartChat={context.membership.role !== "viewer"} />;
}
