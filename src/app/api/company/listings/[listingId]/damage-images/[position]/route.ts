import { Buffer } from "node:buffer";
import { MAX_IMAGE_BYTES } from "@/server/storage/images";
import { renderImageVariant } from "@/server/storage/image-variants";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";
import {
  parseImagePosition,
  parseListingId,
  requireListingContext,
} from "@/server/vehicles/http";
import {
  putDamageImage,
  readOwnDamageImage,
  removeDamageImage,
} from "@/server/vehicles/listings";

type Route = { params: Promise<{ listingId: string; position: string }> };

export async function GET(request: Request, route: Route) {
  try {
    const context = await requireListingContext(request, false);
    const params = await route.params;
    const image = await readOwnDamageImage({
      companyId: context.company.id,
      listingId: parseListingId(params.listingId),
      position: parseImagePosition(params.position),
    });
    const variant = await renderImageVariant(request, image.bytes, image.mimeType);
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

export async function PUT(request: Request, route: Route) {
  try {
    assertSameOrigin(request);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 1_048_576) {
      throw new AccessError(400, "INVALID_IMAGE_SIZE");
    }
    const context = await requireListingContext(request, true);
    const params = await route.params;
    const file = (await request.formData()).get("image");
    if (!(file instanceof File)) throw new AccessError(400, "IMAGE_REQUIRED");
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      throw new AccessError(400, "INVALID_IMAGE_SIZE");
    }
    return Response.json({
      listing: await putDamageImage({
        companyId: context.company.id,
        listingId: parseListingId(params.listingId),
        actorUserId: context.user.id,
        position: parseImagePosition(params.position),
        claimedMime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, route: Route) {
  try {
    assertSameOrigin(request);
    const context = await requireListingContext(request, true);
    const params = await route.params;
    return Response.json({
      listing: await removeDamageImage({
        companyId: context.company.id,
        listingId: parseListingId(params.listingId),
        actorUserId: context.user.id,
        position: parseImagePosition(params.position),
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
