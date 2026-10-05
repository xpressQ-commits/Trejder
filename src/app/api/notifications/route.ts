import { requireAuthenticatedUser } from "@/server/company/context";
import {
  listUserNotifications,
  markUserNotificationsRead,
} from "@/server/notifications";
import { assertSameOrigin, errorResponse } from "@/server/security";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request.headers);
    return Response.json({
      notifications: await listUserNotifications(user.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
const patchSchema = z.object({ id: z.uuid().optional() }).strict();
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAuthenticatedUser(request.headers);
    const parsed = patchSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    await markUserNotificationsRead(user.id, parsed.data.id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
