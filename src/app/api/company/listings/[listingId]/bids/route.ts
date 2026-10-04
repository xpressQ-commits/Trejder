import { cookies } from "next/headers";
import { z } from "zod";
import { listSellerBids } from "@/server/bids";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { AccessError, errorResponse } from "@/server/security";

export async function GET(request: Request, route: { params: Promise<{ listingId: string }> }) { try { const { listingId } = await route.params; if (!z.uuid().safeParse(listingId).success) throw new AccessError(404, "LISTING_NOT_FOUND"); const current = await requireCompanyPermission(request.headers, (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null, "bid:read"); return Response.json({ bids: await listSellerBids(listingId, current.company.id) }); } catch (error) { return errorResponse(error); } }
