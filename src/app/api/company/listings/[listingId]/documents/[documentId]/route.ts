import { Buffer } from "node:buffer";
import { assertSameOrigin, errorResponse } from "@/server/security";
import {
  parseDocumentId,
  parseListingId,
  requireListingContext,
} from "@/server/vehicles/http";
import {
  readOwnListingDocument,
  removeListingDocument,
} from "@/server/vehicles/listings";

type Route = { params: Promise<{ listingId: string; documentId: string }> };

export async function GET(request: Request, route: Route) {
  try {
    const context = await requireListingContext(request, false);
    const params = await route.params;
    const document = await readOwnListingDocument({
      companyId: context.company.id,
      listingId: parseListingId(params.listingId),
      documentId: parseDocumentId(params.documentId),
    });
    return documentResponse(document);
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
      listing: await removeListingDocument({
        companyId: context.company.id,
        listingId: parseListingId(params.listingId),
        actorUserId: context.user.id,
        documentId: parseDocumentId(params.documentId),
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function documentResponse(document: { bytes: Uint8Array; mimeType: string; name: string }) {
  return new Response(Buffer.from(document.bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
