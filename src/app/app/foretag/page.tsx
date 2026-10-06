import { cookies, headers } from "next/headers";
import { CompanyContactForm } from "@/components/company/company-contact-form";
import { CompanyBillingActions } from "@/components/company/company-billing-actions";
import {
  ACTIVE_COMPANY_COOKIE,
  requireActiveCompanyContext,
  requireDealerAdminForBilling,
  requireDealerPermission,
} from "@/server/company/context";
import { getCompanyContact } from "@/server/company/profile";
import { getCompanyBillingSummary } from "@/server/billing";
import { AccessError } from "@/server/security";

export default async function CompanyPage() {
  const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  const requestHeaders = await headers();
  const context = await requireActiveCompanyContext(requestHeaders, companyId);
  if (context.company.kind !== "dealer" || context.membership.role === "private_customer") {
    throw new AccessError(403, "DEALER_ACCESS_REQUIRED");
  }
  if (context.membership.role !== "admin") {
    await requireDealerPermission(requestHeaders, companyId, "company:read");
  }
  const contact = await getCompanyContact(context.company.id);
  const billing = context.membership.role === "admin"
    ? await requireDealerAdminForBilling(requestHeaders, companyId).then(() =>
        getCompanyBillingSummary(context.company.id),
      )
    : null;
  return (
    <section aria-labelledby="company-title">
      <p className="text-sm font-semibold text-[var(--primary)]">
        Företagsprofil
      </p>
      <h1
        id="company-title"
        className="mt-1 text-3xl font-semibold tracking-tight"
      >
        Företag
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Grunduppgifter för det aktiva företaget.
      </p>
      <dl className="mt-7 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 sm:px-6">
        <Info label="Företagsnamn" value={context.company.legalName} />
        <Info
          label="Organisationsnummer"
          value={context.company.organizationNumber}
        />
        <Info label="Kontaktmejl" value={contact.contactEmail} />
        <Info label="Telefonnummer" value={contact.contactPhone || "Saknas"} />
        <Info
          label="Din behörighet"
          value={roleLabel[context.membership.role]}
        />
      </dl>
      {context.membership.role === "admin" ? (
        <>
          {billing?.canAccess ? (
            <CompanyContactForm
              email={contact.contactEmail}
              phone={contact.contactPhone ?? ""}
            />
          ) : null}
          {billing ? <CompanyBillingActions summary={billing} /> : null}
        </>
      ) : null}
    </section>
  );
}

const roleLabel = {
  admin: "Administratör",
  trader: "Handlare",
  viewer: "Läsbehörighet",
  private_customer: "Privatkund",
} as const;
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm font-medium text-[var(--muted)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
