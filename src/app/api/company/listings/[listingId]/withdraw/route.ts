import { assertSameOrigin, errorResponse } from "@/server/security";
import { parseListingId, requireListingContext } from "@/server/vehicles/http";
import { withdrawListing } from "@/server/vehicles/listings";

export async function POST(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireListingContext(request, true);
    const listingId = parseListingId((await route.params).listingId);
    return Response.json({ listing: await withdrawListing({
      companyId: context.company.id,
      listingId,
      actorUserId: context.user.id,
    }) });
  } catch (error) {
    return errorResponse(error);
  }
}
