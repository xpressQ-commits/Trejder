import { describe, expect, it } from "vitest";
import {
  calculateBillableSeats,
  resolveSubscriptionAccess,
  stripeExtraUserQuantity,
  type BillingOverride,
  type StripeBillingState,
} from "./subscription";

describe("subscription policy adversarial boundaries", () => {
  it.each([
    [0, 0, 0, 69_900],
    [1, 0, 0, 69_900],
    [2, 0, 0, 69_900],
    [3, 1, 19_900, 89_800],
    [4, 2, 39_800, 109_700],
  ])(
    "maps %i active memberships to %i additional Stripe seats",
    (activeUsers, extraUsers, extraOre, totalOre) => {
      expect(calculateBillableSeats(activeUsers)).toEqual({
        activeUsers,
        includedUsers: 2,
        extraUsers,
        baseMonthlyExVatOre: 69_900,
        extraMonthlyExVatOre: extraOre,
        totalMonthlyExVatOre: totalOre,
      });
      expect(stripeExtraUserQuantity(activeUsers)).toBe(extraUsers);
    },
  );

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects a manipulated or non-integral active membership count: %s",
    (activeUsers) => {
      expect(() => calculateBillableSeats(activeUsers)).toThrow(RangeError);
      expect(() => stripeExtraUserQuantity(activeUsers)).toThrow(RangeError);
    },
  );

  it("treats a free period as live strictly before, but never at or after, its end", () => {
    const expiry = new Date("2026-10-06T12:00:00.000Z");
    const input = { override: null, freeAccessEndsAt: expiry, stripeState: "none" } as const;

    expect(resolveSubscriptionAccess(input, new Date(expiry.getTime() - 1))).toEqual({
      status: "GRATIS",
      source: "free_access",
      canAccess: true,
    });
    expect(resolveSubscriptionAccess(input, expiry).canAccess).toBe(false);
    expect(resolveSubscriptionAccess(input, new Date(expiry.getTime() + 1)).canAccess).toBe(false);
  });

  it.each<StripeBillingState>(["none", "unpaid", "canceled"])(
    "does not grant access for the non-active Stripe state %s",
    (stripeState) => {
      expect(resolveSubscriptionAccess({ override: null, freeAccessEndsAt: null, stripeState })).toEqual({
        status: "OBETALD",
        source: stripeState === "none" ? "none" : "stripe",
        canAccess: false,
      });
    },
  );

  it("keeps access during the documented Stripe past-due grace state", () => {
    expect(resolveSubscriptionAccess({
      override: null,
      freeAccessEndsAt: null,
      stripeState: "past_due",
    })).toEqual({ status: "PREMIUM", source: "stripe", canAccess: true });
  });

  it("grants Stripe-backed Premium only for an active Stripe subscription", () => {
    expect(resolveSubscriptionAccess({
      override: null,
      freeAccessEndsAt: null,
      stripeState: "active",
    })).toEqual({ status: "PREMIUM", source: "stripe", canAccess: true });
  });

  it.each<{ override: BillingOverride; expected: "PREMIUM" | "OBETALD" }>([
    { override: "manual_block", expected: "OBETALD" },
    { override: "manual_premium", expected: "PREMIUM" },
  ])("keeps $override authoritative over both free and Stripe state", ({ override, expected }) => {
    const resolved = resolveSubscriptionAccess({
      override,
      freeAccessEndsAt: new Date("2099-01-01T00:00:00.000Z"),
      stripeState: "active",
    });

    expect(resolved.status).toBe(expected);
    expect(resolved.source).toBe("manual_override");
    expect(resolved.canAccess).toBe(expected === "PREMIUM");
  });

  it("keeps live free access ahead of an unpaid Stripe state", () => {
    expect(resolveSubscriptionAccess({
      override: null,
      freeAccessEndsAt: new Date("2099-01-01T00:00:00.000Z"),
      stripeState: "unpaid",
    })).toEqual({ status: "GRATIS", source: "free_access", canAccess: true });
  });
});
