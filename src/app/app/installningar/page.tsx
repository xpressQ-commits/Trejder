import { LogoutButton } from "@/components/app-shell/session-controls";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { PrivateProfileForm } from "@/components/account/private-profile-form";
import { getDb } from "@/server/db";
import { company } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const context = await getCurrentCompanyContext();
  const [details] = await getDb().select({ phone: company.contactPhone }).from(company).where(eq(company.id, context.company.id)).limit(1);
  return <section aria-labelledby="settings-title"><p className="text-sm font-semibold text-[var(--primary)]">Konto</p><h1 id="settings-title" className="mt-1 text-3xl font-semibold tracking-tight">Inställningar</h1>{context.membership.role === "private_customer" ? <div className="mt-7"><PrivateProfileForm name={context.user.name} email={context.user.email} phone={details?.phone ?? ""} /></div> : null}<div className="mt-7 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Aktuell session</h2><p className="mt-2 mb-5 max-w-xl text-[var(--muted)]">Logga ut när du är klar, särskilt om du använder en delad enhet.</p><LogoutButton /></div></section>;
}
