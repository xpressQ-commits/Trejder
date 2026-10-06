import { cookies } from "next/headers";
import { z } from "zod";
import { getOwnBid, placeBid } from "@/server/bids";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerMembershipPermission,
  requireDealerPermission,
} from "@/server/company/context";
import {
  AccessError,
  assertSameOrigin,
  errorResponse,
} from "@/server/security";

const schema = z
  .object({ amountOre: z.number().int().positive().max(2_147_483_647) })
  .strict();
async function readContext(request: Request) {
  return requireDealerMembershipPermission(
    request.headers,
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
    "bid:read",
  );
}

async function mutationContext(request: Request) {
  return requireDealerPermission(
    request.headers,
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
    "bid:mutate",
  );
}
export async function GET(
  request: Request,
  route: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await route.params;
    if (!z.uuid().safeParse(listingId).success)
      throw new AccessError(404, "LISTING_NOT_FOUND");
    const current = await readContext(request);
    return Response.json({
      bid: await getOwnBid(listingId, current.company.id),
    });
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
      throw new AccessError(400, "INVALID_BID");
    const current = await mutationContext(request);
    return Response.json(
      {
        bid: await placeBid({
          listingId,
          bidderCompanyId: current.company.id,
          actorUserId: current.user.id,
          amountOre: parsed.data.amountOre,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
