import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { createPlatformCompany, listPlatformCompanies } from "@/server/platform-companies";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const companyInput = z.object({
  legalName: z.string().trim().min(1).max(200),
  organizationNumber: z.string().trim().min(1).max(20),
  contactEmail: z.email().max(320),
}).strict();

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin(request.headers);
    return Response.json({ companies: await listPlatformCompanies() });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin(request.headers);
    const parsed = companyInput.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_REQUEST");
    const created = await createPlatformCompany({ actorUserId: actor.id, ...parsed.data });
    return Response.json({ company: created }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
