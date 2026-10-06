"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Field,
  FormMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
  SelectField,
} from "@/components/ui/form-controls";
import type { SubscriptionSource } from "@/components/platform/subscription-view-model";

type Message = { type: "error" | "success"; text: string };

async function sendCommand(url: string, method: "POST" | "DELETE", body: object) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(result?.error ?? "UNKNOWN");
  }
}

export function PlatformSubscriptionActions({
  companyId,
  currentSource,
}: {
  companyId: string;
  currentSource: SubscriptionSource;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string>();
  const [message, setMessage] = useState<Message>();
  const base = `/api/platform/companies/${companyId}/subscription`;

  async function run(
    key: string,
    url: string,
    method: "POST" | "DELETE",
    body: object,
    success: string,
  ) {
    setPending(key);
    setMessage(undefined);
    try {
      await sendCommand(url, method, body);
      setMessage({ type: "success", text: success });
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      setMessage({
        type: "error",
        text:
          code === "INVALID_FREE_DAYS"
            ? "Ange ett giltigt antal dagar."
            : "Ändringen kunde inte sparas. Försök igen.",
      });
    } finally {
      setPending(undefined);
    }
  }

  function submitFree(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const mode = String(data.get("mode"));
    void run(
      "free",
      `${base}/free`,
      "POST",
      {
        days: Number(data.get("days")),
        mode,
        reason: String(data.get("reason") ?? "").trim() || undefined,
      },
      mode === "extend"
        ? "Gratisperioden har förlängts."
        : "Gratisperioden har ersatts.",
    );
  }

  function submitOverride(
    event: FormEvent<HTMLFormElement>,
    kind: "manual-premium" | "manual-unpaid",
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") ?? "").trim();
    if (!reason) return;
    void run(
      kind,
      `${base}/${kind}`,
      "POST",
      { reason },
      kind === "manual-premium"
        ? "Manuell Premium har aktiverats."
        : "Företaget har markerats som obetalt.",
    );
  }

  return (
    <section aria-labelledby="subscription-actions-title" className="space-y-5">
      <div>
        <h2 id="subscription-actions-title" className="text-xl font-semibold">
          Hantera abonnemang
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Alla ändringar loggas med ditt superadmin-konto. En manuell Premium-
          status registreras som en override och visas aldrig som en Stripe-betalning.
        </p>
      </div>
      {message ? <FormMessage type={message.type}>{message.text}</FormMessage> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={submitFree} className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold">Gratis</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ersätt slutdatumet från idag eller förläng en pågående gratisperiod.
          </p>
          <div className="mt-4 space-y-4">
            <Field label="Antal dagar" name="days" type="number" min={1} max={3650} defaultValue={30} required />
            <SelectField label="Åtgärd" name="mode" defaultValue="replace">
              <option value="replace">Ersätt slutdatum</option>
              <option value="extend">Förläng befintlig period</option>
            </SelectField>
            <Field label="Intern anledning (valfri)" name="reason" maxLength={500} />
            <button className={primaryButtonClassName} disabled={Boolean(pending)}>
              {pending === "free" ? "Sparar…" : "Sätt Gratis"}
            </button>
          </div>
        </form>

        <form onSubmit={(event) => submitOverride(event, "manual-premium")} className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold">Manuell Premium</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ger Premium utan att påstå att Stripe har tagit betalt.
          </p>
          <div className="mt-4 space-y-4">
            <Field label="Intern anledning" name="reason" maxLength={500} required />
            <button className={secondaryButtonClassName} disabled={Boolean(pending)}>
              {pending === "manual-premium" ? "Sparar…" : "Ge manuell Premium"}
            </button>
          </div>
        </form>

        <form onSubmit={(event) => submitOverride(event, "manual-unpaid")} className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold">Obetald</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Begränsar åtkomsten utan att radera faktureringshistorik.
          </p>
          <div className="mt-4 space-y-4">
            <Field label="Intern anledning" name="reason" maxLength={500} required />
            <button className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--danger)] px-4 py-2.5 font-semibold text-[var(--danger)] hover:bg-[var(--danger-surface)]" disabled={Boolean(pending)}>
              {pending === "manual-unpaid" ? "Sparar…" : "Sätt Obetald"}
            </button>
          </div>
        </form>
      </div>

      {currentSource === "manual_override" ? (
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="font-semibold">Ta bort manuell override</h3>
          <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
            Efter borttagning avgör aktiv gratisperiod eller Stripe-status företagets åtkomst.
          </p>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={Boolean(pending)}
            onClick={() => {
              if (!window.confirm("Ta bort den manuella overriden? Underliggande abonnemangsstatus börjar gälla direkt.")) return;
              void run("remove", `${base}/override`, "DELETE", {}, "Den manuella overriden har tagits bort.");
            }}
          >
            {pending === "remove" ? "Tar bort…" : "Ta bort override"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
