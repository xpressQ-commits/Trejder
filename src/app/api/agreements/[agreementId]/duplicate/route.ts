import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE } from "@/server/company/context";
import { duplicateAgreement } from "@/server/agreements";
import { requireAgreementAccess } from "@/server/agreements/access";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await requireAgreementAccess(
      request.headers,
      (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
    );
    const id = z.uuid().safeParse((await params).agreementId);
    if (!id.success) throw new AccessError(404, "AGREEMENT_NOT_FOUND");
    return Response.json(
      {
        agreement: await duplicateAgreement({
          companyId: context.company.id,
          actorUserId: context.user.id,
          agreementId: id.data,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
