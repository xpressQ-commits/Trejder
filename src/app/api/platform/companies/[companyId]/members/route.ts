import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { listPlatformCompanyMembers } from "@/server/platform-companies";
import { AccessError, errorResponse } from "@/server/security";

export async function GET(request: Request, route: { params: Promise<{ companyId: string }> }) {
  try {
    await requirePlatformAdmin(request.headers);
    const { companyId } = await route.params;
    if (!z.uuid().safeParse(companyId).success) throw new AccessError(404, "COMPANY_NOT_FOUND");
    return Response.json({ members: await listPlatformCompanyMembers(companyId) });
  } catch (error) { return errorResponse(error); }
}
