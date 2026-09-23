import { describe, expect, it } from "vitest";
import { canTransitionMembershipState, wouldRemoveLastActiveAdmin } from "./membership";

describe("last active admin protection", () => {
  it("rejects demoting or disabling the final active admin", () => {
    expect(wouldRemoveLastActiveAdmin({ targetRole: "admin", targetStatus: "active", nextRole: "viewer", nextStatus: "active", activeAdminCount: 1 })).toBe(true);
    expect(wouldRemoveLastActiveAdmin({ targetRole: "admin", targetStatus: "active", nextRole: "admin", nextStatus: "suspended", activeAdminCount: 1 })).toBe(true);
  });

  it("allows changes when another active admin remains", () => {
    expect(wouldRemoveLastActiveAdmin({ targetRole: "admin", targetStatus: "active", nextRole: "viewer", nextStatus: "active", activeAdminCount: 2 })).toBe(false);
  });

  it("does not block changes that cannot reduce the active-admin count", () => {
    expect(wouldRemoveLastActiveAdmin({ targetRole: "trader", targetStatus: "active", nextRole: "viewer", nextStatus: "active", activeAdminCount: 1 })).toBe(false);
    expect(wouldRemoveLastActiveAdmin({ targetRole: "admin", targetStatus: "suspended", nextRole: "viewer", nextStatus: "suspended", activeAdminCount: 1 })).toBe(false);
    expect(wouldRemoveLastActiveAdmin({ targetRole: "admin", targetStatus: "active", nextRole: "admin", nextStatus: "active", activeAdminCount: 1 })).toBe(false);
  });
});

describe("membership lifecycle", () => {
  it("treats revocation as terminal", () => {
    expect(canTransitionMembershipState("revoked", "active")).toBe(false);
    expect(canTransitionMembershipState("revoked", "suspended")).toBe(false);
    expect(canTransitionMembershipState("revoked", "revoked")).toBe(true);
  });

  it("allows suspension and reactivation", () => {
    expect(canTransitionMembershipState("active", "suspended")).toBe(true);
    expect(canTransitionMembershipState("suspended", "active")).toBe(true);
  });
});
