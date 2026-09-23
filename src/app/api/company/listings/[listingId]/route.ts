import { assertSameOrigin, AccessError, errorResponse } from "@/server/security";
import { getOwnListing, updateOwnListing } from "@/server/vehicles/listings";
import {
  listingInputSchema,
  parseListingId,
  requireListingContext,
} from "@/server/vehicles/http";

export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    const context = await requireListingContext(request, false);
    const listingId = parseListingId((await route.params).listingId);
    return Response.json({ listing: await getOwnListing(context.company.id, listingId) });
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = listingInputSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
);

export async function PATCH(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireListingContext(request, true);
    const listingId = parseListingId((await route.params).listingId);
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_LISTING_INPUT");
    return Response.json({
      listing: await updateOwnListing({
        companyId: context.company.id,
        listingId,
        actorUserId: context.user.id,
        values: parsed.data,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
