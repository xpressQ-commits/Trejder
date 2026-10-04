"use client";

import { useState, type FormEvent } from "react";
import { Field, FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";

export function PrivateRegistrationForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/private-registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) }).catch(() => null);
    if (!response?.ok) setError(response?.status === 409 ? "E-postadressen används redan." : "Kontot kunde inte skapas. Kontrollera uppgifterna och försök igen.");
    else setDone(true);
    setPending(false);
  }
  if (done) return <FormMessage type="success">Kontrollera din inkorg och verifiera e-postadressen för att aktivera kontot.</FormMessage>;
  return <form onSubmit={submit} className="space-y-5">{error ? <FormMessage type="error">{error}</FormMessage> : null}<Field label="Namn" name="name" autoComplete="name" required /><Field label="Telefonnummer" name="phone" type="tel" autoComplete="tel" required /><Field label="E-postadress" name="email" type="email" autoComplete="email" required /><Field label="Lösenord" name="password" type="password" autoComplete="new-password" minLength={12} hint="Minst 12 tecken." required /><button className={primaryButtonClassName} disabled={pending}>{pending ? "Skapar konto…" : "Skapa privatkonto"}</button></form>;
}
