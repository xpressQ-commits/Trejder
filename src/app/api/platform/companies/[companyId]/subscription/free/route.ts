import { z } from "zod";
import { grantFreeAccess } from "@/server/billing";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const inputSchema = z.object({ days: z.number().int().min(1).max(3650), mode: z.enum(["replace", "extend"]), reason: z.string().trim().max(500).optional() }).strict();
export async function POST(request: Request, route: { params: Promise<{ companyId: string }> }) {
  try {
    assertSameOrigin(request); const actor = await requirePlatformAdmin(request.headers); const { companyId } = await route.params;
    const parsed = inputSchema.safeParse(await request.json());
    if (!z.uuid().safeParse(companyId).success || !parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    return Response.json(await grantFreeAccess({ actorUserId: actor.id, companyId, ...parsed.data }));
  } catch (error) { return errorResponse(error); }
}
