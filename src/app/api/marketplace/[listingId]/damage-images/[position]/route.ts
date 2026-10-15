import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, requireDealerMembershipPermission } from "@/server/company/context";
import { getCompanySubscriptionAccess } from "@/server/billing";
import { hasPlatformAdminAuthority } from "@/server/platform-admin";
import { readMarketplaceDamageImage } from "@/server/marketplace/listings";
import { errorResponse } from "@/server/security";
import { renderImageVariant } from "@/server/storage/image-variants";
import { parseImagePosition, parseListingId } from "@/server/vehicles/http";

export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string; position: string }> },
) {
  try {
    const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerMembershipPermission(
      request.headers,
      companyId,
      "listing:read",
    );
    const params = await route.params;
    const [subscription, isPlatformAdmin] = await Promise.all([
      getCompanySubscriptionAccess(context.company.id),
      hasPlatformAdminAuthority(context.user.id),
    ]);
    const image = await readMarketplaceDamageImage({
      activeCompanyId: context.company.id,
      listingId: parseListingId(params.listingId),
      position: parseImagePosition(params.position),
      hasMarketplaceAccess: subscription.canAccess,
      canViewPrivilegedDetails:
        context.membership.role === "admin" || isPlatformAdmin,
    });
    const variant = await renderImageVariant(request, image.bytes, image.mimeType);
    return new Response(Buffer.from(variant.bytes), {
      headers: {
        "Content-Type": variant.mimeType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
