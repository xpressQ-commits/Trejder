import { z } from "zod";
import { assertSameOrigin, AccessError, errorResponse } from "@/server/security";
import { createDraft, listOwnListings } from "@/server/vehicles/listings";
import { listingInputSchema, requireListingContext } from "@/server/vehicles/http";

export async function GET(request: Request) {
  try {
    const context = await requireListingContext(request, false);
    const rawStatus = new URL(request.url).searchParams.get("status");
    const parsedStatus = z.enum(["draft", "active", "withdrawn"]).nullable().safeParse(rawStatus);
    if (!parsedStatus.success) throw new AccessError(400, "INVALID_STATUS_FILTER");
    return Response.json({
      listings: await listOwnListings(context.company.id, parsedStatus.data ?? undefined),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireListingContext(request, true);
    const parsed = listingInputSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_LISTING_INPUT");
    const listing = await createDraft({
      companyId: context.company.id,
      actorUserId: context.user.id,
      values: parsed.data,
    });
    return Response.json({ listing }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
