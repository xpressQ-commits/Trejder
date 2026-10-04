import { z } from "zod";
import { beginPrivateRegistration, completePrivateRegistration } from "@/server/private-registration";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const startSchema = z.object({ name: z.string().min(2).max(200), phone: z.string().min(5).max(40), email: z.email(), password: z.string().min(12).max(128) }).strict();
const verifySchema = z.object({ token: z.string().min(32).max(200) }).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = startSchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_ACCOUNT_DETAILS");
    await beginPrivateRegistration(parsed.data);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(400, "INVALID_PRIVATE_REGISTRATION");
    await completePrivateRegistration(parsed.data.token);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
