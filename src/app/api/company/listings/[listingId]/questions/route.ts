import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { listSellerBids } from "@/server/bids";
import { listListingQuestions } from "@/server/questions";
import { AccessError, errorResponse } from "@/server/security";

export async function GET(request: Request, route: { params: Promise<{ listingId: string }> }) { try { const { listingId } = await route.params; if (!z.uuid().safeParse(listingId).success) throw new AccessError(404, "LISTING_NOT_FOUND"); const current = await requireCompanyPermission(request.headers, (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null, "listing:read"); await listSellerBids(listingId, current.company.id); return Response.json({ questions: await listListingQuestions(listingId) }); } catch (error) { return errorResponse(error); } }
