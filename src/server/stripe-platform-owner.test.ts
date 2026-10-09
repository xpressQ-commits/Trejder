// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  stripeConstructor: vi.fn(),
}));

vi.mock("@/server/db", () => ({ getDb: mocks.getDb }));
vi.mock("stripe", () => ({ default: mocks.stripeConstructor }));

import { createBillingPortal, createPremiumCheckout } from "./stripe";

describe("Stripe platform-owner boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const limit = vi.fn().mockResolvedValue([{ isPlatformOwner: true }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    mocks.getDb.mockReturnValue({ select: vi.fn(() => ({ from })) });
  });

  it.each([
    ["checkout", () => createPremiumCheckout("company-owner", "owner-user")],
    ["portal", () => createBillingPortal("company-owner")],
  ])(
    "rejects platform-owner %s before creating any Stripe object",
    async (_label, action) => {
      await expect(action()).rejects.toMatchObject({
        status: 409,
        code: "BILLING_EXEMPT",
      });
      expect(mocks.stripeConstructor).not.toHaveBeenCalled();
    },
  );
});
