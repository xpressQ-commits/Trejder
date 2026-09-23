import { cookies, headers } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, requireActiveCompanyContext } from "@/server/company/context";

export async function getCurrentCompanyContext() {
  return requireActiveCompanyContext(await headers(), (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null);
}
