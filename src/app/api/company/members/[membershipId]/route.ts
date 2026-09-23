import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { updateCompanyMembership } from "@/server/company/members";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

export async function PATCH(request: Request, route: { params: Promise<{ membershipId: string }> }) {
  try {
    assertSameOrigin(request);
    const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireCompanyPermission(request.headers, companyId, "members:manage");
    const parsed = z.object({
      role: z.enum(["admin", "trader", "viewer"]).optional(),
      status: z.enum(["active", "suspended", "revoked"]).optional(),
    }).strict().refine((value) => value.role !== undefined || value.status !== undefined).safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    const { membershipId } = await route.params;
    if (!z.uuid().safeParse(membershipId).success) throw new AccessError(404, "MEMBERSHIP_NOT_FOUND");
    await updateCompanyMembership({ companyId: context.company.id, membershipId, actorUserId: context.user.id, ...parsed.data });
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
