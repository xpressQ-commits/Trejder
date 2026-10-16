import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE } from "@/server/company/context";
import { getAgreement, updateAgreementDraft } from "@/server/agreements";
import { requireAgreementAccess } from "@/server/agreements/access";
import { agreementUpdateSchema } from "@/server/agreements/http";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

function agreementId(value: string) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new AccessError(404, "AGREEMENT_NOT_FOUND");
  return parsed.data;
}

async function access(request: Request) {
  return requireAgreementAccess(
    request.headers,
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  try {
    const context = await access(request);
    return Response.json({
      agreement: await getAgreement(
        context.company.id,
        agreementId((await params).agreementId),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  try {
    assertSameOrigin(request);
    const context = await access(request);
    const parsed = agreementUpdateSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_AGREEMENT_INPUT");
    const { version, ...values } = parsed.data;
    return Response.json({
      agreement: await updateAgreementDraft({
        companyId: context.company.id,
        actorUserId: context.user.id,
        agreementId: agreementId((await params).agreementId),
        expectedVersion: version,
        values,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
