import { listPlatformChatThreads } from "@/server/chat";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { errorResponse } from "@/server/security";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin(request.headers);
    return Response.json({ threads: await listPlatformChatThreads() });
  } catch (error) { return errorResponse(error); }
}
