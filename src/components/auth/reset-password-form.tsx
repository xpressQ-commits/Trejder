"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";

export function ResetPasswordForm({ token }: { token?: string }) {
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setPending(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== data.get("confirmPassword")) {
      setError("Lösenorden matchar inte.");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: password }) });
      if (!response.ok) setError("Länken är ogiltig eller har gått ut. Begär en ny länk.");
      else setComplete(true);
    } catch {
      setError("Det gick inte att återställa lösenordet just nu.");
    } finally {
      setPending(false);
    }
  }

  if (complete) return <div className="space-y-5"><FormMessage type="success">Lösenordet är ändrat. Du kan nu logga in.</FormMessage><Link href="/logga-in" className={`${primaryButtonClassName} w-full`}>Logga in</Link></div>;
  if (!token) return <div className="space-y-5"><FormMessage type="error">Återställningslänken saknar en giltig kod.</FormMessage><Link href="/glomt-losenord" className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)] hover:underline">Begär en ny länk</Link></div>;
  return <form onSubmit={submit} className="space-y-5">{error ? <FormMessage type="error">{error}</FormMessage> : null}<Field label="Nytt lösenord" hint="Minst 12 tecken." name="password" type="password" autoComplete="new-password" minLength={12} required /><Field label="Bekräfta lösenord" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /><button type="submit" disabled={pending} className={`${primaryButtonClassName} w-full`}>{pending ? "Sparar…" : "Spara nytt lösenord"}</button></form>;
}
