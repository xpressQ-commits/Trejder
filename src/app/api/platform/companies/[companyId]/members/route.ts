import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { createPlatformCompanyMember, listPlatformCompanyMembers } from "@/server/platform-companies";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

export async function GET(request: Request, route: { params: Promise<{ companyId: string }> }) {
  try {
    await requirePlatformAdmin(request.headers);
    const { companyId } = await route.params;
    if (!z.uuid().safeParse(companyId).success) throw new AccessError(404, "COMPANY_NOT_FOUND");
    return Response.json({ members: await listPlatformCompanyMembers(companyId) });
  } catch (error) { return errorResponse(error); }
}

const createMemberSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(12).max(128),
  role: z.enum(["admin", "trader", "viewer"]),
}).strict();

export async function POST(request: Request, route: { params: Promise<{ companyId: string }> }) {
  try {
    assertSameOrigin(request);
    const admin = await requirePlatformAdmin(request.headers);
    const { companyId } = await route.params;
    if (!z.uuid().safeParse(companyId).success) throw new AccessError(404, "COMPANY_NOT_FOUND");
    const parsed = createMemberSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_ACCOUNT_INPUT");
    await createPlatformCompanyMember({ actorUserId: admin.id, companyId, ...parsed.data });
    return Response.json({ members: await listPlatformCompanyMembers(companyId) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
