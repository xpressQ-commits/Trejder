import { AccessError, constantTimeTextEqual, errorResponse } from "@/server/security";
import { syncPendingSeatQuantities } from "@/server/stripe";
export const runtime = "nodejs";
export async function POST(request: Request) { try {
  const configured = process.env.BILLING_SYNC_SECRET;
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!configured || configured.length < 32 || !constantTimeTextEqual(configured, supplied)) throw new AccessError(401, "INVALID_WORKER_AUTHORIZATION");
  return Response.json(await syncPendingSeatQuantities());
} catch (error) { return errorResponse(error); } }
