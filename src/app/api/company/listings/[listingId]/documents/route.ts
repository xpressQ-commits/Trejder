import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";
import { MAX_DOCUMENT_BYTES } from "@/server/storage/images";
import { parseListingId, requireListingContext } from "@/server/vehicles/http";
import { putListingDocument } from "@/server/vehicles/listings";

export async function POST(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    assertSameOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_DOCUMENT_BYTES + 1_048_576) {
      throw new AccessError(400, "INVALID_DOCUMENT_SIZE");
    }
    const context = await requireListingContext(request, true);
    const listingId = parseListingId((await route.params).listingId);
    const file = (await request.formData()).get("document");
    if (!(file instanceof File)) throw new AccessError(400, "DOCUMENT_REQUIRED");
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      throw new AccessError(400, "INVALID_DOCUMENT_SIZE");
    }
    return Response.json({
      listing: await putListingDocument({
        companyId: context.company.id,
        listingId,
        actorUserId: context.user.id,
        claimedMime: file.type,
        originalName: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
