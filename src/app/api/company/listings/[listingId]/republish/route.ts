import { z } from "zod";
import { canUseUnlimitedListings } from "@/domain/company-policy";
import {
  assertSameOrigin,
  AccessError,
  errorResponse,
} from "@/server/security";
import { parseListingId, requireListingContext } from "@/server/vehicles/http";
import { republishListing } from "@/server/vehicles/listings";

const inputSchema = z
  .object({
    publicationHours: z.union([
      z.literal(48),
      z.literal(72),
      z.literal(96),
      z.literal(120),
      z.null(),
    ]),
  })
  .strict();

export async function POST(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireListingContext(request, true);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AccessError(400, "INVALID_PUBLICATION_DURATION");
    const listingId = parseListingId((await route.params).listingId);
    return Response.json({
      listing: await republishListing({
        companyId: context.company.id,
        listingId,
        actorUserId: context.user.id,
        publicationHours: parsed.data.publicationHours,
        allowUnlimitedPublication: canUseUnlimitedListings(context.company),
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
