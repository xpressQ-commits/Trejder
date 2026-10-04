import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { createPlatformUser } from "@/server/platform-companies";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const inputSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(12).max(128),
  authority: z.enum(["platform_admin", "admin", "trader", "viewer"]),
  companyId: z.uuid().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin(request.headers);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_ACCOUNT_INPUT");
    return Response.json({ user: await createPlatformUser({ actorUserId: actor.id, ...parsed.data }) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
