import { cookies, headers } from "next/headers";
import { ACTIVE_COMPANY_COOKIE, requireCompanyPermission } from "@/server/company/context";

export default async function CompanyPage() {
  const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  const context = await requireCompanyPermission(await headers(), companyId, "company:read");
  return <section aria-labelledby="company-title"><p className="text-sm font-semibold text-[var(--primary)]">Företagsprofil</p><h1 id="company-title" className="mt-1 text-3xl font-semibold tracking-tight">Företag</h1><p className="mt-3 text-[var(--muted)]">Grunduppgifter för det aktiva företaget.</p><dl className="mt-7 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white px-5 sm:px-6"><Info label="Företagsnamn" value={context.company.legalName} /><Info label="Organisationsnummer" value={context.company.organizationNumber} /><Info label="Din behörighet" value={roleLabel[context.membership.role]} /></dl></section>;
}

const roleLabel = { admin: "Administratör", trader: "Handlare", viewer: "Läsbehörighet" } as const;
function Info({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr]"><dt className="text-sm font-medium text-[var(--muted)]">{label}</dt><dd className="font-semibold">{value}</dd></div>; }
