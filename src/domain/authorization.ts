export const roles = ["admin", "trader", "viewer", "private_customer"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "company:read",
  "company:manage",
  "members:manage",
  "listing:read",
  "listing:mutate",
  "bid:read",
  "bid:mutate",
  "match:read",
  "match:accept",
] as const;
export type Permission = (typeof permissions)[number];

const grants = {
  admin: permissions,
  trader: [
    "company:read",
    "listing:read",
    "listing:mutate",
    "bid:read",
    "bid:mutate",
    "match:read",
    "match:accept",
  ],
  viewer: ["company:read", "listing:read", "bid:read", "match:read"],
  private_customer: ["company:read", "listing:read", "listing:mutate", "bid:read", "match:read", "match:accept"],
} as const satisfies Record<Role, readonly Permission[]>;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (grants[role] as readonly Permission[]).includes(permission);
}
