import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_COMPANY_COOKIE,
  requireCompanyPermission,
} from "@/server/company/context";
import { confirmDealCompletion } from "@/server/deals";
import {
  AccessError,
  assertSameOrigin,
  errorResponse,
} from "@/server/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  try {
    assertSameOrigin(request);
    const current = await requireCompanyPermission(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
      "listing:mutate",
    );
    const parsed = z.uuid().safeParse((await params).dealId);
    if (!parsed.success) throw new AccessError(404, "DEAL_NOT_FOUND");
    return Response.json({
      deal: await confirmDealCompletion({
        companyId: current.company.id,
        actorUserId: current.user.id,
        dealId: parsed.data,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
