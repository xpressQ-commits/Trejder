import { z } from "zod";
import { getPlatformChatThread } from "@/server/chat";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { AccessError, errorResponse } from "@/server/security";

export async function GET(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    await requirePlatformAdmin(request.headers);
    const parsed = z.uuid().safeParse((await params).threadId);
    if (!parsed.success) throw new AccessError(404, "CHAT_THREAD_NOT_FOUND");
    return Response.json(await getPlatformChatThread(parsed.data));
  } catch (error) { return errorResponse(error); }
}
