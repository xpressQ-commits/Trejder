import { PlatformCompanyAdmin } from "@/components/platform/platform-company-admin";
import { listPlatformCompanies } from "@/server/platform-companies";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  return <section aria-labelledby="platform-title">
    <p className="text-sm font-semibold text-[var(--primary)]">Global administration</p>
    <h1 id="platform-title" className="mt-1 text-3xl font-semibold tracking-tight">Företag och behörigheter</h1>
    <p className="mt-3 mb-7 text-[var(--muted)]">Skapa, uppdatera, pausa och återaktivera företag samt hantera användarnas roller.</p>
    <PlatformCompanyAdmin initialCompanies={await listPlatformCompanies()} />
  </section>;
}
