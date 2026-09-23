import { Buffer } from "node:buffer";
import { MAX_IMAGE_BYTES } from "@/server/storage/images";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";
import {
  parseImagePosition,
  parseListingId,
  requireListingContext,
} from "@/server/vehicles/http";
import {
  putListingImage,
  readOwnListingImage,
  removeListingImage,
} from "@/server/vehicles/listings";

type ImageRoute = { params: Promise<{ listingId: string; position: string }> };

export async function GET(request: Request, route: ImageRoute) {
  try {
    const context = await requireListingContext(request, false);
    const params = await route.params;
    const listingId = parseListingId(params.listingId);
    const position = parseImagePosition(params.position);
    const image = await readOwnListingImage({
      companyId: context.company.id,
      listingId,
      position,
    });
    return new Response(Buffer.from(image.bytes), {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, route: ImageRoute) {
  try {
    assertSameOrigin(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMAGE_BYTES + 1024 * 1024) {
      throw new AccessError(400, "INVALID_IMAGE_SIZE");
    }
    const context = await requireListingContext(request, true);
    const params = await route.params;
    const listingId = parseListingId(params.listingId);
    const position = parseImagePosition(params.position);
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) throw new AccessError(400, "IMAGE_REQUIRED");
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      throw new AccessError(400, "INVALID_IMAGE_SIZE");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return Response.json({ listing: await putListingImage({
      companyId: context.company.id,
      listingId,
      actorUserId: context.user.id,
      position,
      claimedMime: file.type,
      bytes,
    }) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, route: ImageRoute) {
  try {
    assertSameOrigin(request);
    const context = await requireListingContext(request, true);
    const params = await route.params;
    const listingId = parseListingId(params.listingId);
    const position = parseImagePosition(params.position);
    return Response.json({ listing: await removeListingImage({
      companyId: context.company.id,
      listingId,
      actorUserId: context.user.id,
      position,
    }) });
  } catch (error) {
    return errorResponse(error);
  }
}
