import { cookies, headers } from "next/headers";
import {
  ACTIVE_COMPANY_COOKIE,
  getAuthenticatedUser,
  listActiveCompanyContexts,
  requireActiveCompanyContext,
  requireDealerPermission,
  requirePrivateCustomerContext,
  type ActiveCompanyContext,
} from "@/server/company/context";

export async function getOptionalCurrentCompanyContext(): Promise<ActiveCompanyContext | null> {
  const requestHeaders = await headers();
  const user = await getAuthenticatedUser(requestHeaders);
  if (!user) return null;
  const selectedId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  const available = await listActiveCompanyContexts(user.id);
  const selected = available.find((item) => item.companyId === selectedId);
  if (!selected) return null;
  return {
    user,
    company: {
      id: selected.companyId,
      legalName: selected.legalName,
      organizationNumber: selected.organizationNumber,
      kind: selected.kind,
    },
    membership: { id: selected.membershipId, role: selected.role },
  };
}

export async function getCurrentCompanyContext() {
  return requireActiveCompanyContext(
    await headers(),
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
  );
}

export async function getCurrentDealerContext() {
  return requireDealerPermission(
    await headers(),
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
    "listing:read",
  );
}

export async function getCurrentPrivateCustomerContext() {
  return requirePrivateCustomerContext(
    await headers(),
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
  );
}
