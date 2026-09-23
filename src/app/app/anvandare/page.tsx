import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberAdmin } from "@/components/company/member-admin";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";
import { listCompanyMembers } from "@/server/company/members";
import { listCompanyInvitations } from "@/server/company/invitations";

export default async function UsersPage() {
  let initialMembers;
  let initialInvitations;
  try {
    const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
    const context = await requireCompanyPermission(await headers(), companyId, "members:manage");
    initialMembers = await listCompanyMembers(context.company.id);
    initialInvitations = await listCompanyInvitations(context.company.id);
  } catch { redirect("/app"); }
  return <section aria-labelledby="users-title"><p className="text-sm font-semibold text-[var(--primary)]">Administration</p><h1 id="users-title" className="mt-1 text-3xl font-semibold tracking-tight">Användare</h1><p className="mt-3 mb-7 text-[var(--muted)]">Hantera vilka som har åtkomst till företaget.</p><MemberAdmin initialMembers={initialMembers} initialInvitations={initialInvitations} /></section>;
}
