import { requireAuthenticatedUser } from "@/server/company/context";
import { listUserNotifications, markUserNotificationsRead } from "@/server/notifications";
import { assertSameOrigin, errorResponse } from "@/server/security";
export async function GET(request: Request) { try { const user = await requireAuthenticatedUser(request.headers); return Response.json({ notifications: await listUserNotifications(user.id) }); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request) { try { assertSameOrigin(request); const user = await requireAuthenticatedUser(request.headers); await markUserNotificationsRead(user.id); return Response.json({ ok: true }); } catch (error) { return errorResponse(error); } }
