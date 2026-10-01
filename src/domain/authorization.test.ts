import { describe, expect, it } from "vitest";
import { hasPermission, permissions, roles, type Permission, type Role } from "./authorization";

const expectedGrants = {
  admin: new Set<Permission>(permissions),
  trader: new Set<Permission>([
    "company:read",
    "listing:read",
    "listing:mutate",
    "bid:read",
    "bid:mutate",
    "match:read",
    "match:accept",
  ]),
  viewer: new Set<Permission>(["company:read", "listing:read", "bid:read", "match:read"]),
} satisfies Record<Role, ReadonlySet<Permission>>;

describe("role permissions", () => {
  it.each(roles)("matches the complete permission contract for %s", (role) => {
    for (const permission of permissions) {
      expect(hasPermission(role, permission), `${role} / ${permission}`).toBe(
        expectedGrants[role].has(permission),
      );
    }
  });

  it("lets admins manage members and company settings", () => {
    expect(hasPermission("admin", "listing:mutate")).toBe(true);
    expect(hasPermission("admin", "members:manage")).toBe(true);
    expect(hasPermission("admin", "company:manage")).toBe(true);
  });

  it("lets traders mutate marketplace data but not company administration", () => {
    expect(hasPermission("trader", "listing:mutate")).toBe(true);
    expect(hasPermission("trader", "bid:mutate")).toBe(true);
    expect(hasPermission("trader", "match:accept")).toBe(true);
    expect(hasPermission("trader", "members:manage")).toBe(false);
    expect(hasPermission("trader", "company:manage")).toBe(false);
  });

  it("keeps viewers read-only", () => {
    expect(hasPermission("viewer", "listing:read")).toBe(true);
    expect(hasPermission("viewer", "bid:read")).toBe(true);
    expect(hasPermission("viewer", "listing:mutate")).toBe(false);
    expect(hasPermission("viewer", "bid:mutate")).toBe(false);
    expect(hasPermission("viewer", "match:accept")).toBe(false);
  });
});
