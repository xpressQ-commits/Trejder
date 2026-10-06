import { z } from "zod";
import { removeSubscriptionOverride } from "@/server/billing";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";
export async function DELETE(request: Request, route: { params: Promise<{ companyId: string }> }) { try {
  assertSameOrigin(request); const actor = await requirePlatformAdmin(request.headers); const { companyId } = await route.params;
  if (!z.uuid().safeParse(companyId).success) throw new AccessError(400, "INVALID_REQUEST");
  return Response.json(await removeSubscriptionOverride({ actorUserId: actor.id, companyId }));
} catch (error) { return errorResponse(error); } }
