import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACTIVE_COMPANY_COOKIE,
  getAuthenticatedUser,
  listActiveCompanyContexts,
  requireCompanyPermission,
  requireDealerPermission,
  requirePrivateCustomerContext,
  type ActiveCompanyContext,
} from "@/server/company/context";
import { AccessError } from "@/server/security";

async function withBillingRemediation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AccessError && error.code === "SUBSCRIPTION_REQUIRED") {
      redirect("/app/foretag");
    }
    throw error;
  }
}

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
  const requestHeaders = await headers();
  const selectedCompanyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  return withBillingRemediation(() =>
    requireCompanyPermission(
      requestHeaders,
      selectedCompanyId,
      "company:read",
    ),
  );
}

export async function getCurrentDealerContext() {
  const requestHeaders = await headers();
  const selectedCompanyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  return withBillingRemediation(() =>
    requireDealerPermission(requestHeaders, selectedCompanyId, "listing:read"),
  );
}

export async function getCurrentPrivateCustomerContext() {
  return requirePrivateCustomerContext(
    await headers(),
    (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
  );
}
