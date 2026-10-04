"use client";

import { useState, type FormEvent } from "react";
import { Field, FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";

export function AccountApplicationForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(false);
    const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch("/api/account-applications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    if (response.ok) { form.reset(); setSent(true); }
    else {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "ACCOUNT_APPLICATION_PENDING") setSent(true);
      else setError(true);
    }
    setPending(false);
  }

  if (sent) return <FormMessage type="success">Tack! Vi har tagit emot din ansökan och återkommer inom 48 timmar.</FormMessage>;
  return <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    {error ? <div className="sm:col-span-2"><FormMessage type="error">Ansökan kunde inte skickas. Kontrollera uppgifterna och försök igen.</FormMessage></div> : null}
    <Field label="Förnamn" name="firstName" required maxLength={100} />
    <Field label="Efternamn" name="lastName" required maxLength={100} />
    <div className="sm:col-span-2"><Field label="Företagsnamn" name="companyName" required maxLength={200} /></div>
    <Field label="Organisationsnummer" name="organizationNumber" required maxLength={20} />
    <Field label="Telefonnummer" name="phone" type="tel" required maxLength={40} />
    <div className="sm:col-span-2"><Field label="Mejladress" name="email" type="email" required maxLength={320} /></div>
    <div className="hidden" aria-hidden="true"><Field label="Webbplats" name="website" tabIndex={-1} autoComplete="off" /></div>
    <div className="sm:col-span-2"><button className={`${primaryButtonClassName} w-full`} disabled={pending}>{pending ? "Skickar…" : "Skicka ansökan"}</button></div>
  </form>;
}
