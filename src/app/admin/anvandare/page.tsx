import { PlatformUserAdmin } from "@/components/platform/platform-user-admin";
import { listAccountApplications } from "@/server/account-applications";
import { listPlatformCompanies } from "@/server/platform-companies";

export const dynamic = "force-dynamic";

export default async function PlatformUsersPage() {
  return <section aria-labelledby="platform-users-title">
    <p className="text-sm font-semibold text-[var(--primary)]">Global administration</p>
    <h1 id="platform-users-title" className="mt-1 text-3xl font-semibold tracking-tight">Användare och ansökningar</h1>
    <p className="mt-3 mb-7 text-[var(--muted)]">Granska kontoansökningar och skapa användare direkt för befintliga företag.</p>
    <PlatformUserAdmin initialApplications={await listAccountApplications()} companies={await listPlatformCompanies()} />
  </section>;
}
