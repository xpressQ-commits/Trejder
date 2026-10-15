import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerMembershipPermission,
} from "@/server/company/context";
import { getMarketplaceListing } from "@/server/marketplace/listings";
import { AccessError, errorResponse } from "@/server/security";
import { getCompanySubscriptionAccess } from "@/server/billing";
import { hasPlatformAdminAuthority } from "@/server/platform-admin";

export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    const listingId = (await route.params).listingId;
    if (!z.uuid().safeParse(listingId).success)
      throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
    const companyId =
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerMembershipPermission(
      request.headers,
      companyId,
      "listing:read",
    );
    const [subscription, isPlatformAdmin] = await Promise.all([
      getCompanySubscriptionAccess(context.company.id),
      hasPlatformAdminAuthority(context.user.id),
    ]);
    return Response.json({
      listing: await getMarketplaceListing(
        context.company.id,
        listingId,
        subscription.canAccess,
        context.membership.role === "admin" || isPlatformAdmin,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
