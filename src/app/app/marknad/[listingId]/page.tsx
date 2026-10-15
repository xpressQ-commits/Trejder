import { MarketplaceDetail } from "@/components/marketplace/marketplace-detail";
import { getCurrentDealerContext } from "@/app/app/_lib/current-context";
import { getMarketplaceListing } from "@/server/marketplace/listings";
import { notFound, redirect } from "next/navigation";
import { getCompanySubscriptionAccess } from "@/server/billing";
import { findCompanyDealByListing } from "@/server/deals";
import { hasPlatformAdminAuthority } from "@/server/platform-admin";

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const context = await getCurrentDealerContext();
  const listingId = (await params).listingId;
  const [subscription, isPlatformAdmin] = await Promise.all([
    getCompanySubscriptionAccess(context.company.id),
    hasPlatformAdminAuthority(context.user.id),
  ]);
  const canViewPrivilegedDetails =
    context.membership.role === "admin" || isPlatformAdmin;
  let listing;
  try {
    listing = await getMarketplaceListing(
      context.company.id,
      listingId,
      subscription.canAccess,
      canViewPrivilegedDetails,
    );
  } catch {
    const deal = await findCompanyDealByListing(context.company.id, listingId);
    if (deal) redirect(`/app/affarer/${deal.id}`);
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
