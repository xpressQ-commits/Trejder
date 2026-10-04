import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { createOrGetChatThread, listDealerChatThreads } from "@/server/chat";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const createSchema = z.object({ bidId: z.uuid() }).strict();

async function context(request: Request, mutate: boolean) {
  const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  return requireCompanyPermission(request.headers, companyId, mutate ? "listing:mutate" : "listing:read");
}

export async function GET(request: Request) {
  try {
    const current = await context(request, false);
    return Response.json({ threads: await listDealerChatThreads(current.company.id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const current = await requireCompanyPermission(request.headers, companyId, "bid:read");
    if (current.membership.role === "viewer") throw new AccessError(403, "FORBIDDEN");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    return Response.json(await createOrGetChatThread({
      bidId: parsed.data.bidId,
      actorCompanyId: current.company.id,
      actorUserId: current.user.id,
    }), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
