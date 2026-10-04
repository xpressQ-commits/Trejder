import { listAccountApplications } from "@/server/account-applications";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { errorResponse } from "@/server/security";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin(request.headers);
    return Response.json({ applications: await listAccountApplications() });
  } catch (error) { return errorResponse(error); }
}
