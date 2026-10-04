import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { getDealerChatThread, sendChatMessage } from "@/server/chat";
import { AccessError, assertSameOrigin, errorResponse } from "@/server/security";

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
const idSchema = z.uuid();

async function context(request: Request, mutate: boolean) {
  const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  return requireCompanyPermission(request.headers, companyId, mutate ? "listing:mutate" : "listing:read");
}

export async function GET(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const current = await context(request, false);
    const parsedId = idSchema.safeParse((await params).threadId);
    if (!parsedId.success) throw new AccessError(404, "CHAT_THREAD_NOT_FOUND");
    return Response.json(await getDealerChatThread(current.company.id, parsedId.data));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    assertSameOrigin(request);
    const current = await context(request, true);
    const parsedId = idSchema.safeParse((await params).threadId);
    const parsed = messageSchema.safeParse(await request.json());
    if (!parsedId.success) throw new AccessError(404, "CHAT_THREAD_NOT_FOUND");
    if (!parsed.success) throw new AccessError(400, "INVALID_CHAT_MESSAGE");
    return Response.json(await sendChatMessage({
      companyId: current.company.id,
      actorUserId: current.user.id,
      threadId: parsedId.data,
      body: parsed.data.body,
    }));
  } catch (error) { return errorResponse(error); }
}
