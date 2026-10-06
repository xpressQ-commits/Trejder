"use client";

import { useState } from "react";
import {
  FormMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-controls";
import {
  formatAdminDate,
  formatSekFromOre,
} from "@/components/platform/subscription-view-model";

type Action = "checkout" | "portal";

type BillingSummary = {
  status: "GRATIS" | "PREMIUM" | "OBETALD";
  source: "free_access" | "manual_override" | "stripe" | "none";
  freeUntil: Date | string | null;
  periodEnd: Date | string | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  stripeStatus: string;
  activeUsers: number;
  includedUsers: number;
  extraUsers: number;
  extraMonthlyExVatOre: number;
  totalMonthlyExVatOre: number;
};

const statusLabels = {
  GRATIS: "Gratis",
  PREMIUM: "Premium",
  OBETALD: "Obetald",
} as const;

export function CompanyBillingActions({
  summary,
  canManage,
}: {
  summary: BillingSummary;
  canManage: boolean;
}) {
  const [pending, setPending] = useState<Action>();
  const [error, setError] = useState<string>();
  const canStartCheckout =
    summary.status === "OBETALD" &&
    summary.source !== "manual_override" &&
    (summary.stripeStatus === "none" || summary.stripeStatus === "canceled");

  async function openBilling(action: Action) {
    setPending(action);
    setError(undefined);
    try {
      const response = await fetch(`/api/billing/${action}`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.url)
        throw new Error(result?.error ?? "UNKNOWN");
      window.location.assign(result.url);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UNKNOWN";
      setError(
        code === "BILLING_NOT_CONFIGURED"
          ? "Betalningen är inte tillgänglig ännu. Kontakta Trejder."
          : code === "STRIPE_CUSTOMER_REQUIRED"
            ? "Ingen faktureringsportal finns ännu. Starta Premium först."
            : "Faktureringen kunde inte öppnas. Försök igen.",
      );
      setPending(undefined);
    }
  }

  return (
    <section
      aria-labelledby="billing-title"
      className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <h2 id="billing-title" className="text-xl font-semibold">
        Abonnemang och fakturering
      </h2>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Premium kostar 699 kr per månad exklusive moms och inkluderar två aktiva
        användare. Varje ytterligare aktiv användare kostar 199 kr per månad
        exklusive moms.
      </p>
      <dl className="mt-5 grid gap-4 rounded-xl bg-[var(--surface-subtle)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-[var(--muted)]">Status</dt>
          <dd className="mt-1 font-semibold">{statusLabels[summary.status]}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">Aktiva användare</dt>
          <dd className="mt-1 font-semibold">
            {summary.activeUsers}{" "}
            <span className="font-normal text-[var(--muted)]">
              ({summary.includedUsers} ingår, {summary.extraUsers} extra)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">Månadskostnad</dt>
          <dd className="mt-1 font-semibold">
            {formatSekFromOre(summary.totalMonthlyExVatOre)}{" "}
            <span className="font-normal text-[var(--muted)]">exkl. moms</span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">
            {summary.status === "GRATIS"
              ? "Gratis till"
              : "Nästa betalning / periodslut"}
          </dt>
          <dd className="mt-1 font-semibold">
            {formatAdminDate(
              summary.status === "GRATIS"
                ? summary.freeUntil
                : summary.periodEnd,
            )}
          </dd>
        </div>
      </dl>
      {summary.status === "OBETALD" ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-[var(--warning)] bg-[var(--warning-surface)] px-3 py-2.5 text-sm text-[var(--warning)]"
        >
          Ni kan se marknaden, men ett aktivt abonnemang krävs för att lägga bud
          och använda övriga företagsfunktioner.
        </p>
      ) : null}
      {summary.source === "manual_override" ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          En manuell superadmin-status är aktiv. Kontakta Trejder innan ett nytt
          betalt abonnemang startas.
        </p>
      ) : null}
      {summary.status === "GRATIS" ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Premium kan startas när gratisperioden har löpt ut eller avslutats av
          Trejder.
        </p>
      ) : null}
      {error ? (
        <div className="mt-4">
          <FormMessage type="error">{error}</FormMessage>
        </div>
      ) : null}
      {canManage ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {canStartCheckout ? (
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={Boolean(pending)}
              onClick={() => void openBilling("checkout")}
            >
              {pending === "checkout"
                ? "Öppnar säker betalning…"
                : "Starta eller förnya Premium"}
            </button>
          ) : null}
          {summary.hasStripeCustomer ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={Boolean(pending)}
              onClick={() => void openBilling("portal")}
            >
              {pending === "portal"
                ? "Öppnar fakturering…"
                : "Hantera betalning och fakturor"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-sm text-[var(--muted)]">
          En företagsadministratör kan starta eller hantera abonnemanget.
        </p>
      )}
      <p className="mt-4 text-sm text-[var(--muted)]">
        Kort- och betalningsuppgifter hanteras säkert hos Stripe och lagras inte
        i Trejder.
      </p>
    </section>
  );
}
