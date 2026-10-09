import { describe, expect, it } from "vitest";
import { canUseUnlimitedListings, isBillingExempt } from "./company-policy";

describe("platform owner company policy", () => {
  it("grants both protected capabilities only from the server-owned flag", () => {
    expect(isBillingExempt({ isPlatformOwner: true })).toBe(true);
    expect(canUseUnlimitedListings({ isPlatformOwner: true })).toBe(true);
    expect(isBillingExempt({ isPlatformOwner: false })).toBe(false);
    expect(canUseUnlimitedListings({ isPlatformOwner: false })).toBe(false);
  });
});
