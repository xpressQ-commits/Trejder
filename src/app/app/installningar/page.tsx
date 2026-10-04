import { LogoutButton } from "@/components/app-shell/session-controls";
import { getCurrentCompanyContext } from "@/app/app/_lib/current-context";
import { PrivateProfileForm } from "@/components/account/private-profile-form";
import { getDb } from "@/server/db";
import { company } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { PreferencesForm } from "@/components/preferences/preferences-form";
import { getTranslations } from "@/i18n/server";

export default async function SettingsPage() {
  const context = await getCurrentCompanyContext();
  const { t } = await getTranslations();
  const [details] = await getDb().select({ phone: company.contactPhone }).from(company).where(eq(company.id, context.company.id)).limit(1);
  return <section aria-labelledby="settings-title"><p className="text-sm font-semibold text-[var(--primary)]">{t("settings.eyebrow")}</p><h1 id="settings-title" className="mt-1 text-3xl font-semibold tracking-tight">{t("settings.title")}</h1><div className="mt-7"><PreferencesForm /></div>{context.membership.role === "private_customer" ? <div className="mt-7"><PrivateProfileForm name={context.user.name} email={context.user.email} phone={details?.phone ?? ""} /></div> : null}<div className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="text-lg font-semibold">{t("settings.session")}</h2><p className="mt-2 mb-5 max-w-xl text-[var(--muted)]">{t("settings.sessionHint")}</p><LogoutButton /></div></section>;
}
