import { cookies } from "next/headers";
import { ACTIVE_COMPANY_COOKIE } from "@/server/company/context";
import {
  createAgreementDraft,
  listAgreementDealOptions,
  listAgreements,
} from "@/server/agreements";
import { requireAgreementAccess } from "@/server/agreements/access";
import { agreementInputSchema } from "@/server/agreements/http";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

async function access(request: Request) {
  return requireAgreementAccess(
    request.headers,
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
  );
}

export async function GET(request: Request) {
  try {
    const context = await access(request);
    const [agreements, deals] = await Promise.all([
      listAgreements(context.company.id),
      listAgreementDealOptions(context.company.id),
    ]);
    return Response.json({ agreements, deals });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await access(request);
    const parsed = agreementInputSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_AGREEMENT_INPUT");
    const agreement = await createAgreementDraft({
      companyId: context.company.id,
      actorUserId: context.user.id,
      values: parsed.data,
    });
    return Response.json({ agreement }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
