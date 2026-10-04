import { cookies } from "next/headers";
import { z } from "zod";
import { acceptBid } from "@/server/bids";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const schema = z.object({ bindingConfirmed: z.literal(true) }).strict();
export async function POST(request: Request, route: { params: Promise<{ listingId: string; bidId: string }> }) { try { assertSameOrigin(request); const params = await route.params; const parsed = schema.safeParse(await request.json()); if (!z.uuid().safeParse(params.listingId).success || !z.uuid().safeParse(params.bidId).success || !parsed.success) throw new AccessError(400, "ACCEPTANCE_CONFIRMATION_REQUIRED"); const current = await requireCompanyPermission(request.headers, (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null, "match:accept"); return Response.json({ match: await acceptBid({ listingId: params.listingId, bidId: params.bidId, sellerCompanyId: current.company.id, actorUserId: current.user.id }) }); } catch (error) { return errorResponse(error); } }
