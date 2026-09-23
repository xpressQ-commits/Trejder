import { and, eq } from "drizzle-orm";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { company, companyMembership } from "@/server/db/schema";
import { hasPermission, type Permission, type Role } from "@/domain/authorization";
import { selectActiveCompany } from "@/domain/company-context";
import { AccessError } from "@/server/security";

export const ACTIVE_COMPANY_COOKIE = "handlarborsen_company";

export type AuthenticatedUser = { id: string; email: string; name: string };
export type ActiveCompanyContext = {
  user: AuthenticatedUser;
  company: { id: string; legalName: string; organizationNumber: string };
  membership: { id: string; role: Role };
};

export async function getAuthenticatedUser(headers: Headers): Promise<AuthenticatedUser | null> {
  const result = await getAuth().api.getSession({ headers });
  return result?.user
    ? { id: result.user.id, email: result.user.email, name: result.user.name }
    : null;
}

export async function requireAuthenticatedUser(headers: Headers): Promise<AuthenticatedUser> {
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
      role: companyMembership.role,
    })
    .from(companyMembership)
    .innerJoin(company, eq(company.id, companyMembership.companyId))
    .where(and(
      eq(companyMembership.userId, userId),
      eq(companyMembership.status, "active"),
      eq(company.status, "active"),
    ));
}

export async function requireActiveCompanyContext(
  headers: Headers,
  selectedCompanyId: string | null,
): Promise<ActiveCompanyContext> {
  const user = await requireAuthenticatedUser(headers);
  const available = await listActiveCompanyContexts(user.id);
  if (available.length === 0) throw new AccessError(403, "ACTIVE_MEMBERSHIP_REQUIRED");
  const selected = selectActiveCompany(available, selectedCompanyId);
  if (!selected) throw new AccessError(403, selectedCompanyId ? "INVALID_COMPANY_CONTEXT" : "COMPANY_SELECTION_REQUIRED");
  return {
    user,
    company: { id: selected.companyId, legalName: selected.legalName, organizationNumber: selected.organizationNumber },
    membership: { id: selected.membershipId, role: selected.role },
  };
}

export async function requireCompanyPermission(
  headers: Headers,
  selectedCompanyId: string | null,
  permission: Permission,
): Promise<ActiveCompanyContext> {
  const context = await requireActiveCompanyContext(headers, selectedCompanyId);
  if (!hasPermission(context.membership.role, permission)) throw new AccessError(403, "FORBIDDEN");
  return context;
}
