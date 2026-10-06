import { z } from "zod";
import { setManualUnpaid } from "@/server/billing";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";
const schema = z.object({ reason: z.string().trim().max(500).optional() }).strict();
export async function POST(request: Request, route: { params: Promise<{ companyId: string }> }) { try {
  assertSameOrigin(request); const actor = await requirePlatformAdmin(request.headers); const { companyId } = await route.params; const parsed = schema.safeParse(await request.json());
  if (!z.uuid().safeParse(companyId).success || !parsed.success) throw new AccessError(400, "INVALID_REQUEST");
  return Response.json(await setManualUnpaid({ actorUserId: actor.id, companyId, ...parsed.data }));
} catch (error) { return errorResponse(error); } }
