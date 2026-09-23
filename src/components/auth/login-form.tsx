"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";
import { safeReturnTo } from "@/lib/navigation";

export function LoginForm({ returnTo = "/app", invitationAccepted = false }: { returnTo?: string; invitationAccepted?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      if (!response.ok) {
        setError("E-postadressen eller lösenordet är felaktigt.");
        return;
      }
      router.replace(safeReturnTo(returnTo));
      router.refresh();
    } catch {
      setError("Det gick inte att logga in just nu. Försök igen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {invitationAccepted ? <FormMessage type="success">Inbjudan är accepterad. Logga in för att fortsätta.</FormMessage> : null}
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <Field label="E-postadress" name="email" type="email" autoComplete="email" inputMode="email" required />
      <Field label="Lösenord" name="password" type="password" autoComplete="current-password" required />
      <div className="flex flex-col gap-3 pt-1">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>{pending ? "Loggar in…" : "Logga in"}</button>
        <Link href="/glomt-losenord" className="inline-flex min-h-11 items-center justify-center rounded-lg font-semibold text-[var(--primary)] hover:underline">Glömt lösenordet?</Link>
      </div>
    </form>
  );
}
