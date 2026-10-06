import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireDealerAdminForBilling,
} from "@/server/company/context";
import {
  inviteCompanyMember,
  listCompanyInvitations,
} from "@/server/company/invitations";
import {
  AccessError,
  assertSameOrigin,
  errorResponse,
} from "@/server/security";

export async function GET(request: Request) {
  try {
    const companyId =
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerAdminForBilling(
      request.headers,
      companyId,
    );
    return Response.json({
      invitations: await listCompanyInvitations(context.company.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const companyId =
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireDealerAdminForBilling(
      request.headers,
      companyId,
    );
    const parsed = z
      .object({
        email: z.email().max(320),
        role: z.enum(["admin", "trader", "viewer"]),
      })
      .strict()
      .safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    const invitation = await inviteCompanyMember({
      companyId: context.company.id,
      actorUserId: context.user.id,
      ...parsed.data,
    });
    return Response.json({ invitation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
