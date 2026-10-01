import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { updatePlatformCompanyMembership } from "@/server/platform-companies";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const updateInput = z.object({
  role: z.enum(["admin", "trader", "viewer"]).optional(),
  status: z.enum(["active", "suspended", "revoked"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, route: { params: Promise<{ companyId: string; membershipId: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin(request.headers);
    const { companyId, membershipId } = await route.params;
    if (!z.uuid().safeParse(companyId).success || !z.uuid().safeParse(membershipId).success) {
      throw new AccessError(404, "MEMBERSHIP_NOT_FOUND");
    }
    const parsed = updateInput.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    const updated = await updatePlatformCompanyMembership({
      actorUserId: actor.id,
      companyId,
      membershipId,
      ...parsed.data,
    });
    return Response.json({ membership: updated });
  } catch (error) { return errorResponse(error); }
}
