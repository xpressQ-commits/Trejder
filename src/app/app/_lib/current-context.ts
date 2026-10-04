import { cookies, headers } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, requireActiveCompanyContext, requireDealerPermission, requirePrivateCustomerContext } from "@/server/company/context";

export async function getCurrentCompanyContext() {
  return requireActiveCompanyContext(await headers(), (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null);
}

export async function getCurrentDealerContext() {
  return requireDealerPermission(await headers(), (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null, "listing:read");
}

export async function getCurrentPrivateCustomerContext() {
  return requirePrivateCustomerContext(await headers(), (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null);
}
