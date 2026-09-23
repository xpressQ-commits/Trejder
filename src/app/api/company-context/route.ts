import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, listActiveCompanyContexts, requireAuthenticatedUser } from "@/server/company/context";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request.headers);
    const contexts = await listActiveCompanyContexts(user.id);
    const selectedCompanyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    return Response.json({
      companies: contexts,
      activeCompanyId: contexts.some((item) => item.companyId === selectedCompanyId)
        ? selectedCompanyId
        : contexts.length === 1 ? contexts[0].companyId : null,
    });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAuthenticatedUser(request.headers);
    const parsed = z.object({ companyId: z.uuid() }).strict().safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    const contexts = await listActiveCompanyContexts(user.id);
    if (!contexts.some((item) => item.companyId === parsed.data.companyId)) throw new AccessError(403, "INVALID_COMPANY_CONTEXT");
    (await cookies()).set(ACTIVE_COMPANY_COOKIE, parsed.data.companyId, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return Response.json({ activeCompanyId: parsed.data.companyId });
  } catch (error) { return errorResponse(error); }
}
