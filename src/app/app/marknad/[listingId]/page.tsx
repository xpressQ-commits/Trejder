import { MarketplaceDetail } from "@/components/marketplace/marketplace-detail";

export default async function MarketplaceListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  return <MarketplaceDetail listingId={(await params).listingId} />;
}
