// @vitest-environment node

import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccessError } from "./security";
import { seatSyncIdempotencyKey, verifyStripeWebhook } from "./stripe";

const webhookSecret = "whsec_trejder_test_secret";
const previousStripeKey = process.env.STRIPE_SECRET_KEY;
const payload = JSON.stringify({
  id: "evt_trejder_signature_test",
  object: "event",
  type: "invoice.paid",
  data: { object: { id: "in_test", object: "invoice" } },
});

describe("Stripe webhook signature boundary", () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_trejder_signature_boundary";
  });

  afterAll(() => {
    if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousStripeKey;
  });

  it("accepts the exact signed raw payload", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    expect(verifyStripeWebhook(payload, signature, webhookSecret)).toMatchObject({
      id: "evt_trejder_signature_test",
      type: "invoice.paid",
    });
  });

  it("rejects a forged signature", () => {
    expect(() => verifyStripeWebhook(payload, "t=1,v1=forged", webhookSecret)).toThrowError(
      expect.objectContaining<Partial<AccessError>>({
        status: 400,
        code: "INVALID_STRIPE_SIGNATURE",
      }),
    );
  });

  it("rejects payload tampering after signing", () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    expect(() => verifyStripeWebhook(`${payload} `, signature, webhookSecret)).toThrowError(
      expect.objectContaining<Partial<AccessError>>({
        status: 400,
        code: "INVALID_STRIPE_SIGNATURE",
      }),
    );
  });
});

describe("Stripe seat synchronization idempotency", () => {
  it("is stable across retries and rotates only with a new desired operation generation", () => {
    expect(seatSyncIdempotencyKey("company-a", 7, 3, false)).toBe(seatSyncIdempotencyKey("company-a", 7, 3, false));
    expect(seatSyncIdempotencyKey("company-a", 8, 3, false)).not.toBe(seatSyncIdempotencyKey("company-a", 7, 3, false));
    expect(seatSyncIdempotencyKey("company-a", 7, 4, false)).not.toBe(seatSyncIdempotencyKey("company-a", 7, 3, false));
  });
});
