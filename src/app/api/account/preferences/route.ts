import { z } from "zod";
import { requireAuthenticatedUser } from "@/server/company/context";
import { getUserPreferences, updateUserPreferences } from "@/server/preferences";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";
const schema = z.object({ theme: z.enum(["system", "light", "dark"]), locale: z.enum(["sv", "en"]) }).strict();
export async function GET(request: Request) { try { const current = await requireAuthenticatedUser(request.headers); return Response.json({ preferences: await getUserPreferences(current.id) }); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request) { try { assertSameOrigin(request); const current = await requireAuthenticatedUser(request.headers); const parsed = schema.safeParse(await request.json()); if (!parsed.success) throw new AccessError(400, "INVALID_PREFERENCES"); return Response.json({ preferences: await updateUserPreferences(current.id, parsed.data) }); } catch (error) { return errorResponse(error); } }
