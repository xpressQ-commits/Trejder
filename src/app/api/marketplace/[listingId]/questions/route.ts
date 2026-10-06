import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerMembershipPermission,
  requireDealerPermission,
} from "@/server/company/context";
import { askListingQuestion, listListingQuestions } from "@/server/questions";
import { getMarketplaceListing } from "@/server/marketplace/listings";
import {
  AccessError,
  assertSameOrigin,
  errorResponse,
} from "@/server/security";

const schema = z.object({ body: z.string().min(1).max(1000) }).strict();
export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await route.params;
    if (!z.uuid().safeParse(listingId).success)
      throw new AccessError(404, "LISTING_NOT_FOUND");
    const current = await requireDealerMembershipPermission(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
      "listing:read",
    );
    await getMarketplaceListing(current.company.id, listingId);
    return Response.json({ questions: await listListingQuestions(listingId) });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { listingId } = await route.params;
    const parsed = schema.safeParse(await request.json());
    if (!z.uuid().safeParse(listingId).success || !parsed.success)
      throw new AccessError(400, "INVALID_QUESTION");
    const current = await requireDealerPermission(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
      "listing:read",
    );
    return Response.json(
      {
        question: await askListingQuestion({
          listingId,
          authorCompanyId: current.company.id,
          actorUserId: current.user.id,
          body: parsed.data.body,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
