import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { answerListingQuestion } from "@/server/questions";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const schema = z.object({ body: z.string().min(1).max(1000) }).strict();
export async function POST(request: Request, route: { params: Promise<{ listingId: string; questionId: string }> }) { try { assertSameOrigin(request); const params = await route.params; const parsed = schema.safeParse(await request.json()); if (!z.uuid().safeParse(params.listingId).success || !z.uuid().safeParse(params.questionId).success || !parsed.success) throw new AccessError(400, "INVALID_ANSWER"); const current = await requireCompanyPermission(request.headers, (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null, "listing:mutate"); return Response.json({ question: await answerListingQuestion({ listingId: params.listingId, questionId: params.questionId, sellerCompanyId: current.company.id, actorUserId: current.user.id, body: parsed.data.body }) }); } catch (error) { return errorResponse(error); } }
