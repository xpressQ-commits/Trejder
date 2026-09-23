import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { revokeCompanyInvitation } from "@/server/company/invitations";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

export async function DELETE(request: Request, route: { params: Promise<{ invitationId: string }> }) {
  try {
    assertSameOrigin(request);
    const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireCompanyPermission(request.headers, companyId, "members:manage");
    const { invitationId } = await route.params;
    if (!z.uuid().safeParse(invitationId).success) throw new AccessError(404, "INVITATION_NOT_FOUND");
    await revokeCompanyInvitation({ companyId: context.company.id, invitationId, actorUserId: context.user.id });
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
