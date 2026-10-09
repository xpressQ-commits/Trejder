import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/app-shell/session-controls";
import { PrivateProfileForm } from "@/components/account/private-profile-form";
import { CompanyBillingActions } from "@/components/company/company-billing-actions";
import { CompanyContactForm } from "@/components/company/company-contact-form";
import { MemberAdmin } from "@/components/company/member-admin";
import { PreferencesForm } from "@/components/preferences/preferences-form";
import { getTranslations } from "@/i18n/server";
import { getCompanyBillingSummary } from "@/server/billing";
import {
  ACTIVE_COMPANY_COOKIE,
  requireActiveCompanyContext,
} from "@/server/company/context";
import { listCompanyInvitations } from "@/server/company/invitations";
import { listCompanyMembers } from "@/server/company/members";
import { getCompanyContact } from "@/server/company/profile";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const requestHeaders = await headers();
  const companyId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  const context = await requireActiveCompanyContext(requestHeaders, companyId);
  const { t } = await getTranslations();

  if (
    context.company.kind === "private" ||
    context.membership.role === "private_customer"
  ) {
    const contact = await getCompanyContact(context.company.id);
    return (
      <SettingsShell
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
      >
        <PreferencesForm />
        <div className="mt-7">
          <PrivateProfileForm
            name={context.user.name}
            email={context.user.email}
            phone={contact.contactPhone ?? ""}
          />
        </div>
        <SessionCard
          title={t("settings.session")}
          hint={t("settings.sessionHint")}
        />
      </SettingsShell>
    );
  }

  const isAdmin = context.membership.role === "admin";
  const [contact, billing, members, invitations] = await Promise.all([
    getCompanyContact(context.company.id),
    getCompanyBillingSummary(context.company.id),
    isAdmin ? listCompanyMembers(context.company.id) : Promise.resolve([]),
    isAdmin ? listCompanyInvitations(context.company.id) : Promise.resolve([]),
  ]);
  const billingState = (await searchParams).billing;

  return (
    <SettingsShell eyebrow={t("settings.eyebrow")} title={t("settings.title")}>
      {billingState === "required" ? (
        <div
          role="status"
          className="mb-7 rounded-xl border border-[var(--warning)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--warning)]"
        >
          Ett aktivt abonnemang krävs för att lägga bud och använda
          företagsfunktioner. Ni kan fortfarande se marknaden.
        </div>
      ) : null}
      {billingState === "success" ? (
        <div
          role="status"
          className="mb-7 rounded-xl border border-[var(--success)] bg-[var(--success-surface)] px-4 py-3 text-sm text-[var(--success)]"
        >
          Betalningen är genomförd. Abonnemangsstatusen uppdateras så snart
          Stripe har bekräftat betalningen.
        </div>
      ) : null}
      {billingState === "cancelled" ? (
        <div
          role="status"
          className="mb-7 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm"
        >
          Betalningen avbröts. Inga kortuppgifter sparades av Trejder.
        </div>
      ) : null}

      <section id="foretag" aria-labelledby="company-title">
        <h2 id="company-title" className="text-xl font-semibold">
          Företag
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Grunduppgifter för det aktiva företaget.
        </p>
        <dl className="mt-5 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 sm:px-6">
          <Info label="Företagsnamn" value={context.company.legalName} />
          <Info
            label="Organisationsnummer"
            value={context.company.organizationNumber}
          />
          <Info label="Kontaktmejl" value={contact.contactEmail} />
          <Info
            label="Telefonnummer"
            value={contact.contactPhone || "Saknas"}
          />
          <Info
            label="Din behörighet"
            value={roleLabels[context.membership.role]}
          />
        </dl>
        {isAdmin ? (
          <CompanyContactForm
            email={contact.contactEmail}
            phone={contact.contactPhone ?? ""}
          />
        ) : null}
      </section>

      <CompanyBillingActions summary={billing} canManage={isAdmin} />

      {isAdmin ? (
        <section
          id="anvandare"
          aria-labelledby="members-heading"
          className="mt-10"
        >
          <h2 id="members-heading" className="text-2xl font-semibold">
            Användare
          </h2>
          <p className="mt-2 mb-5 text-[var(--muted)]">
            Hantera företagets användare, behörigheter och telefonnummer.
          </p>
          <MemberAdmin
            initialMembers={members}
            initialInvitations={invitations}
            billingExempt={billing.billingExempt}
          />
        </section>
      ) : null}

      <div className="mt-10">
        <PreferencesForm />
      </div>
      <SessionCard
        title={t("settings.session")}
        hint={t("settings.sessionHint")}
      />
    </SettingsShell>
  );
}

function SettingsShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="settings-title">
      <p className="text-sm font-semibold text-[var(--primary)]">{eyebrow}</p>
      <h1
        id="settings-title"
        className="mt-1 text-3xl font-semibold tracking-tight"
      >
        {title}
      </h1>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function SessionCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 mb-5 max-w-xl text-[var(--muted)]">{hint}</p>
      <LogoutButton />
    </div>
  );
}

const roleLabels = {
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
