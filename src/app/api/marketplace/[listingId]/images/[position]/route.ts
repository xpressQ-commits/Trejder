import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerMembershipPermission,
} from "@/server/company/context";
import { readMarketplaceListingImage } from "@/server/marketplace/listings";
import { AccessError, errorResponse } from "@/server/security";
import { renderImageVariant } from "@/server/storage/image-variants";

export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string; position: string }> },
) {
  try {
    const params = await route.params;
    if (!z.uuid().safeParse(params.listingId).success)
      throw new AccessError(404, "IMAGE_NOT_FOUND");
    const position = Number(params.position);
    if (!Number.isInteger(position) || position < 1 || position > 5)
      throw new AccessError(404, "IMAGE_NOT_FOUND");
    const companyId =
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerMembershipPermission(
      request.headers,
      companyId,
      "listing:read",
    );
    const image = await readMarketplaceListingImage({
      activeCompanyId: context.company.id,
      listingId: params.listingId,
      position,
    });
    const variant = await renderImageVariant(
      request,
      image.bytes,
      image.mimeType,
    );
    return new Response(Buffer.from(variant.bytes), {
      headers: {
        "Content-Type": variant.mimeType,
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
