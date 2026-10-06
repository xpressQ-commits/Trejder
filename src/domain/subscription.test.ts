import { describe, expect, it } from "vitest";
import { calculateBillableSeats, resolveSubscriptionAccess, stripeExtraUserQuantity } from "./subscription";

describe("subscription policy", () => {
  it.each([[0, 0], [1, 0], [2, 0], [3, 1], [6, 4]])("maps %i active users to %i extras", (active, extras) => {
    expect(stripeExtraUserQuantity(active)).toBe(extras);
  });
  it("uses integer öre", () => {
    expect(calculateBillableSeats(5)).toMatchObject({ extraMonthlyExVatOre: 59_700, totalMonthlyExVatOre: 129_600 });
  });
  it("rejects invalid counts", () => expect(() => calculateBillableSeats(-1)).toThrow(RangeError));
  it("expires free access exactly at its end", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(resolveSubscriptionAccess({ override: null, freeAccessEndsAt: now, stripeState: "none" }, now).canAccess).toBe(false);
  });
  it("applies override precedence", () => {
    const future = new Date("2030-01-01T00:00:00Z");
    expect(resolveSubscriptionAccess({ override: "manual_block", freeAccessEndsAt: future, stripeState: "active" }).status).toBe("OBETALD");
    expect(resolveSubscriptionAccess({ override: "manual_premium", freeAccessEndsAt: future, stripeState: "unpaid" }).status).toBe("PREMIUM");
    expect(resolveSubscriptionAccess({ override: null, freeAccessEndsAt: future, stripeState: "unpaid" }).status).toBe("GRATIS");
  });
  it("keeps conservative access during Stripe collection retries", () => {
    expect(resolveSubscriptionAccess({ override: null, freeAccessEndsAt: null, stripeState: "past_due" }).canAccess).toBe(true);
    expect(resolveSubscriptionAccess({ override: null, freeAccessEndsAt: null, stripeState: "unpaid" }).canAccess).toBe(false);
  });
});
