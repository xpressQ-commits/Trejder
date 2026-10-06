import { errorResponse, AccessError } from "@/server/security";
import { processStripeEvent, verifyStripeWebhook } from "@/server/stripe";
export const runtime = "nodejs";
export async function POST(request: Request) { try {
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new AccessError(400, "INVALID_STRIPE_SIGNATURE");
  const event = verifyStripeWebhook(await request.text(), signature);
  return Response.json(await processStripeEvent(event));
} catch (error) { return errorResponse(error); } }
