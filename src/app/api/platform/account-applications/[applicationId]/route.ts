import { z } from "zod";
import { approveAccountApplication, rejectAccountApplication } from "@/server/account-applications";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

export async function PATCH(request: Request, route: { params: Promise<{ applicationId: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requirePlatformAdmin(request.headers);
    const applicationId = (await route.params).applicationId;
    if (!z.uuid().safeParse(applicationId).success) throw new AccessError(404, "ACCOUNT_APPLICATION_NOT_FOUND");
    const parsed = z.object({ decision: z.enum(["approve", "reject"]) }).strict().safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_ACCOUNT_APPLICATION_DECISION");
    const application = parsed.data.decision === "approve"
      ? await approveAccountApplication({ applicationId, actorUserId: actor.id })
      : await rejectAccountApplication({ applicationId, actorUserId: actor.id });
    return Response.json({ application });
  } catch (error) { return errorResponse(error); }
}
