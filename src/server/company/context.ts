import { and, eq } from "drizzle-orm";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { company, companyMembership } from "@/server/db/schema";
import {
  hasPermission,
  type Permission,
  type Role,
} from "@/domain/authorization";
import { selectActiveCompany } from "@/domain/company-context";
import { AccessError } from "@/server/security";
import { getCompanySubscriptionAccess } from "@/server/billing";

export const ACTIVE_COMPANY_COOKIE = "trejder_company";

export type AuthenticatedUser = { id: string; email: string; name: string };
export type ActiveCompanyContext = {
  user: AuthenticatedUser;
  company: {
    id: string;
    legalName: string;
    organizationNumber: string;
    kind: "dealer" | "private";
    isPlatformOwner: boolean;
  };
  membership: { id: string; role: Role };
};

export async function getAuthenticatedUser(
  headers: Headers,
): Promise<AuthenticatedUser | null> {
  const result = await getAuth().api.getSession({ headers });
  return result?.user
    ? { id: result.user.id, email: result.user.email, name: result.user.name }
    : null;
}

export async function requireAuthenticatedUser(
  headers: Headers,
): Promise<AuthenticatedUser> {
  const current = await getAuthenticatedUser(headers);
  if (!current) throw new AccessError(401, "AUTHENTICATION_REQUIRED");
  return current;
}

export async function listActiveCompanyContexts(userId: string) {
  return getDb()
    .select({
      membershipId: companyMembership.id,
      companyId: company.id,
      legalName: company.legalName,
      organizationNumber: company.organizationNumber,
      kind: company.kind,
      isPlatformOwner: company.isPlatformOwner,
      role: companyMembership.role,
    })
    .from(companyMembership)
    .innerJoin(company, eq(company.id, companyMembership.companyId))
    .where(
      and(
        eq(companyMembership.userId, userId),
        eq(companyMembership.status, "active"),
        eq(company.status, "active"),
      ),
    );
}

export async function requireActiveCompanyContext(
  headers: Headers,
  selectedCompanyId: string | null,
): Promise<ActiveCompanyContext> {
  const user = await requireAuthenticatedUser(headers);
  const available = await listActiveCompanyContexts(user.id);
  if (available.length === 0)
    throw new AccessError(403, "ACTIVE_MEMBERSHIP_REQUIRED");
  const selected = selectActiveCompany(available, selectedCompanyId);
  if (!selected)
    throw new AccessError(
      403,
      selectedCompanyId
        ? "INVALID_COMPANY_CONTEXT"
        : "COMPANY_SELECTION_REQUIRED",
    );
  return {
    user,
    company: {
      id: selected.companyId,
      legalName: selected.legalName,
      organizationNumber: selected.organizationNumber,
      kind: selected.kind,
      isPlatformOwner: selected.isPlatformOwner,
    },
    membership: { id: selected.membershipId, role: selected.role },
  };
}

export async function requireCompanyPermission(
  headers: Headers,
  selectedCompanyId: string | null,
  permission: Permission,
): Promise<ActiveCompanyContext> {
  const context = await requireActiveCompanyContext(headers, selectedCompanyId);
  if (!hasPermission(context.membership.role, permission))
    throw new AccessError(403, "FORBIDDEN");
  if (context.company.kind === "dealer") {
    const subscription = await getCompanySubscriptionAccess(context.company.id);
    if (!subscription.canAccess)
      throw new AccessError(403, "SUBSCRIPTION_REQUIRED");
  }
  return context;
}

/**
 * Read-only dealer surfaces may be available while billing is being remediated.
 * This still reloads the active membership and verifies the requested role
 * permission; it deliberately does not grant any subscription-gated mutation.
 */
export async function requireDealerMembershipPermission(
  headers: Headers,
  selectedCompanyId: string | null,
  permission: Permission,
): Promise<ActiveCompanyContext> {
  const context = await requireActiveCompanyContext(headers, selectedCompanyId);
  if (
    context.company.kind !== "dealer" ||
    context.membership.role === "private_customer"
  ) {
    throw new AccessError(403, "DEALER_ACCESS_REQUIRED");
  }
  if (!hasPermission(context.membership.role, permission)) {
    throw new AccessError(403, "FORBIDDEN");
  }
  return context;
}

export async function requireDealerPermission(
  headers: Headers,
  selectedCompanyId: string | null,
  permission: Permission,
): Promise<ActiveCompanyContext> {
  const context = await requireDealerMembershipPermission(
    headers,
    selectedCompanyId,
    permission,
  );
  const subscription = await getCompanySubscriptionAccess(context.company.id);
  if (!subscription.canAccess) {
    throw new AccessError(403, "SUBSCRIPTION_REQUIRED");
  }
  return context;
}

/** Billing/remediation deliberately checks membership and ADMIN role, but bypasses the subscription gate. */
export async function requireDealerAdminForBilling(
  headers: Headers,
  selectedCompanyId: string | null,
) {
  const context = await requireActiveCompanyContext(headers, selectedCompanyId);
  if (
    context.company.kind !== "dealer" ||
    context.membership.role !== "admin" ||
    !hasPermission(context.membership.role, "company:manage")
  ) {
    throw new AccessError(403, "DEALER_ADMIN_REQUIRED");
  }
  return context;
}

export async function requirePrivateCustomerContext(
  headers: Headers,
  selectedCompanyId: string | null,
): Promise<ActiveCompanyContext> {
  const context = await requireActiveCompanyContext(headers, selectedCompanyId);
  if (
    context.company.kind !== "private" ||
    context.membership.role !== "private_customer"
  ) {
    throw new AccessError(403, "PRIVATE_CUSTOMER_ACCESS_REQUIRED");
  }
  return context;
}
