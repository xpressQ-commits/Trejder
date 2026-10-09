import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PlatformSubscriptionActions } from "@/components/platform/platform-subscription-actions";
import {
  formatAdminDate,
  formatSekFromOre,
  membershipRoleLabel,
  membershipStatusLabel,
  subscriptionSourceLabel,
  subscriptionStatusLabel,
} from "@/components/platform/subscription-view-model";
import { getPlatformCompanyBillingDetail } from "@/server/billing";

export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium break-words">{value || "—"}</dd>
    </div>
  );
}

export default async function PlatformCompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const result = await getPlatformCompanyBillingDetail(companyId).catch(
    (error: unknown) => {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "COMPANY_NOT_FOUND"
      )
        return null;
      throw error;
    },
  );
  if (!result) notFound();
  const company = {
    id: result.company.id,
    legalName: result.company.legalName,
    organizationNumber: result.company.organizationNumber,
    contactPhone: result.company.contactPhone,
    isPlatformOwner: result.company.isPlatformOwner,
    contactEmail: result.company.contactEmail,
    createdAt: result.company.createdAt,
    activeUserCount: result.subscription.activeUsers,
    includedUserCount: result.subscription.includedUsers,
    extraBillableUserCount: result.subscription.extraUsers,
    subscription: {
      status: (
        {
          INTERN: "internal",
          GRATIS: "free",
          PREMIUM: "premium",
          OBETALD: "unpaid",
        } as const
      )[result.subscription.status],
      source: result.subscription.source,
      freeUntil: result.company.freeAccessEndsAt,
      periodEnd: result.company.stripePeriodEnd,
      stripeStatus: result.company.stripeStatus,
      stripeCustomerId: result.company.stripeCustomerId,
      stripeSubscriptionId: result.company.stripeSubscriptionId,
      monthlyBaseAmountOre: result.subscription.baseMonthlyExVatOre,
      monthlyExtraUserAmountOre: result.subscription.extraMonthlyExVatOre,
      monthlyTotalAmountOre: result.subscription.totalMonthlyExVatOre,
      overrideReason: result.company.overrideReason,
    },
    members: result.users.map((member) => ({
      ...member,
      isBillableSeat: member.billableSeat,
    })),
  };

  return (
    <section aria-labelledby="company-title" className="space-y-7">
      <div>
        <Link
          href="/admin/foretag"
          className="text-sm font-semibold text-[var(--primary)] underline decoration-transparent underline-offset-4 hover:decoration-current"
        >
          ← Alla företag
        </Link>
        <h1
          id="company-title"
          className="mt-3 text-3xl font-semibold tracking-tight"
        >
          {company.legalName}
        </h1>
        {company.isPlatformOwner ? (
          <p className="mt-2 font-semibold text-[var(--success)]">
            Trejder internkonto · Avgiftsbefriad
          </p>
        ) : null}
        <p className="mt-2 text-[var(--muted)]">
          Hantera abonnemang och granska företagets användare.
        </p>
      </div>

      <section
        aria-labelledby="company-details-title"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      >
        <h2 id="company-details-title" className="text-xl font-semibold">
          Företag
        </h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Juridiskt namn" value={company.legalName} />
          <Detail
            label="Organisationsnummer"
            value={company.organizationNumber}
          />
          <Detail label="Telefon" value={company.contactPhone} />
          <Detail label="Kontaktadress" value={company.contactEmail} />
          <Detail label="Skapat" value={formatAdminDate(company.createdAt)} />
        </dl>
      </section>

      <section
        aria-labelledby="subscription-title"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      >
        <h2 id="subscription-title" className="text-xl font-semibold">
          Abonnemang
        </h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail
            label="Status"
            value={subscriptionStatusLabel(company.subscription.status)}
          />
          <Detail
            label="Källa"
            value={subscriptionSourceLabel(company.subscription.source)}
          />
          <Detail
            label="Gratis till"
            value={formatAdminDate(company.subscription.freeUntil)}
          />
          <Detail
            label="Nästa betalning / periodslut"
            value={formatAdminDate(company.subscription.periodEnd)}
          />
          <Detail label="Aktiva användare" value={company.activeUserCount} />
          <Detail label="Ingår" value={company.includedUserCount} />
          <Detail
            label="Extra användare"
            value={company.extraBillableUserCount}
          />
          <Detail
            label="Extra användarkostnad"
            value={`${formatSekFromOre(company.subscription.monthlyExtraUserAmountOre)}/mån exkl. moms`}
          />
          <Detail
            label="Grundpris"
            value={`${formatSekFromOre(company.subscription.monthlyBaseAmountOre)}/mån exkl. moms`}
          />
          <Detail
            label="Beräknad månadskostnad"
            value={`${formatSekFromOre(company.subscription.monthlyTotalAmountOre)}/mån exkl. moms`}
          />
          {company.subscription.overrideReason ? (
            <Detail
              label="Intern anledning"
              value={company.subscription.overrideReason}
            />
          ) : null}
        </dl>

        <details className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">
            Teknisk Stripe-information
          </summary>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <Detail
              label="Stripe-status"
              value={company.subscription.stripeStatus}
            />
            <Detail
              label="Stripe Customer ID"
              value={
                <code className="text-sm">
                  {company.subscription.stripeCustomerId ?? "—"}
                </code>
              }
            />
            <Detail
              label="Stripe Subscription ID"
              value={
                <code className="text-sm">
                  {company.subscription.stripeSubscriptionId ?? "—"}
                </code>
              }
            />
          </dl>
        </details>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        {company.isPlatformOwner ? (
          <p className="font-medium text-[var(--success)]">
            Abonnemangs- och Stripe-åtgärder är avstängda för Trejders
            internkonto.
          </p>
        ) : (
          <PlatformSubscriptionActions
            companyId={company.id}
            currentSource={company.subscription.source}
          />
        )}
      </section>

      <section
        aria-labelledby="members-title"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      >
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 id="members-title" className="text-xl font-semibold">
              Användare
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Endast aktiva medlemskap räknas som fakturerbara platser.
            </p>
          </div>
          <p className="font-semibold">
            {company.activeUserCount} aktiva · {company.extraBillableUserCount}{" "}
            extra
          </p>
        </div>
        {company.members.length === 0 ? (
          <p className="mt-5 text-[var(--muted)]">
            Företaget saknar användare.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {company.members.map((member) => (
              <li
                key={member.id}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-sm break-all text-[var(--muted)]">
                    {member.email}
                  </p>
                </div>
                <div className="text-sm">
                  <p>{membershipRoleLabel(member.role)}</p>
                  <p className="text-[var(--muted)]">
                    {membershipStatusLabel(member.status)}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-sm font-medium ${member.isBillableSeat ? "bg-[var(--success-surface)] text-[var(--success)]" : "bg-[var(--surface-subtle)] text-[var(--muted)]"}`}
                >
                  {member.isBillableSeat ? "Fakturerbar plats" : "Räknas inte"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
