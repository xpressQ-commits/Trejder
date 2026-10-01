import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { updatePlatformCompany } from "@/server/platform-companies";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const updateInput = z.object({
  legalName: z.string().trim().min(1).max(200).optional(),
  organizationNumber: z.string().trim().min(1).max(20).optional(),
  contactEmail: z.email().max(320).optional(),
  status: z.enum(["active", "suspended"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, route: { params: Promise<{ companyId: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin(request.headers);
    const { companyId } = await route.params;
    if (!z.uuid().safeParse(companyId).success) throw new AccessError(404, "COMPANY_NOT_FOUND");
    const parsed = updateInput.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    const updated = await updatePlatformCompany({ actorUserId: actor.id, companyId, ...parsed.data });
    return Response.json({ company: updated });
  } catch (error) { return errorResponse(error); }
}
