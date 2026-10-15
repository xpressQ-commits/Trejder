import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, requireDealerMembershipPermission } from "@/server/company/context";
import { readMarketplaceListingDocument } from "@/server/marketplace/listings";
import { errorResponse } from "@/server/security";
import { parseDocumentId, parseListingId } from "@/server/vehicles/http";

export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string; documentId: string }> },
) {
  try {
    const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    await requireDealerMembershipPermission(request.headers, companyId, "listing:read");
    const params = await route.params;
    const document = await readMarketplaceListingDocument({
      listingId: parseListingId(params.listingId),
      documentId: parseDocumentId(params.documentId),
    });
    return new Response(Buffer.from(document.bytes), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
