import { z } from "zod";
import { requireAuthenticatedUser } from "@/server/company/context";
import {
  getPushPublicKey,
  isTrustedPushEndpoint,
  removePushSubscription,
  savePushSubscription,
} from "@/server/push-notifications";
import {
  AccessError,
  assertSameOrigin,
  errorResponse,
} from "@/server/security";

const subscriptionSchema = z
  .object({
    endpoint: z.url().max(2048).refine(isTrustedPushEndpoint),
    expirationTime: z.number().nullable(),
    keys: z
      .object({
        p256dh: z.string().min(1).max(512),
        auth: z.string().min(1).max(512),
      })
      .strict(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request.headers);
    const publicKey = getPushPublicKey();
    if (!publicKey) throw new AccessError(503, "PUSH_NOT_CONFIGURED");
    return Response.json({ publicKey });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireAuthenticatedUser(request.headers);
    const parsed = subscriptionSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AccessError(400, "INVALID_PUSH_SUBSCRIPTION");
    await savePushSubscription({
      userId: current.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      expiresAt: parsed.data.expirationTime
        ? new Date(parsed.data.expirationTime)
        : null,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireAuthenticatedUser(request.headers);
    const parsed = z
      .object({ endpoint: z.url().max(2048).refine(isTrustedPushEndpoint) })
      .strict()
      .safeParse(await request.json());
    if (!parsed.success)
      throw new AccessError(400, "INVALID_PUSH_SUBSCRIPTION");
    await removePushSubscription(current.id, parsed.data.endpoint);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
