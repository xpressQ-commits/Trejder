import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireActiveCompanyContext } from "@/server/company/context";
import { readMarketplaceListingImage } from "@/server/marketplace/listings";
import { AccessError, errorResponse } from "@/server/security";

export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string; position: string }> },
) {
  try {
    const params = await route.params;
    if (!z.uuid().safeParse(params.listingId).success) throw new AccessError(404, "IMAGE_NOT_FOUND");
    const position = Number(params.position);
    if (!Number.isInteger(position) || position < 1 || position > 3) throw new AccessError(404, "IMAGE_NOT_FOUND");
    const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireActiveCompanyContext(request.headers, companyId);
    const image = await readMarketplaceListingImage({
      activeCompanyId: context.company.id,
      listingId: params.listingId,
      position,
    });
    return new Response(Buffer.from(image.bytes), { headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    return errorResponse(error);
  }
}
