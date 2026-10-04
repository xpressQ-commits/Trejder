import { cookies } from "next/headers";
import { z } from "zod";
import { getOwnBid, placeBid } from "@/server/bids";
import { ACTIVE_COMPANY_COOKIE, requireDealerPermission } from "@/server/company/context";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const schema = z.object({ amountOre: z.number().int().positive().max(2_147_483_647) }).strict();
async function context(request: Request, mutate: boolean) { return requireDealerPermission(request.headers, (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null, mutate ? "bid:mutate" : "bid:read"); }
export async function GET(request: Request, route: { params: Promise<{ listingId: string }> }) { try { const { listingId } = await route.params; if (!z.uuid().safeParse(listingId).success) throw new AccessError(404, "LISTING_NOT_FOUND"); const current = await context(request, false); return Response.json({ bid: await getOwnBid(listingId, current.company.id) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request, route: { params: Promise<{ listingId: string }> }) { try { assertSameOrigin(request); const { listingId } = await route.params; const parsed = schema.safeParse(await request.json()); if (!z.uuid().safeParse(listingId).success || !parsed.success) throw new AccessError(400, "INVALID_BID"); const current = await context(request, true); return Response.json({ bid: await placeBid({ listingId, bidderCompanyId: current.company.id, actorUserId: current.user.id, amountOre: parsed.data.amountOre }) }, { status: 201 }); } catch (error) { return errorResponse(error); } }
