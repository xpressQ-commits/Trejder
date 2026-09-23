"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password && password !== data.get("confirmPassword")) {
      setError("Lösenorden matchar inte.");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: data.get("name") || undefined, password: password || undefined }),
      });
      if (response.ok) {
        const result = (await response.json()) as { requiresSignIn?: boolean };
        router.replace(result.requiresSignIn ? "/logga-in?next=/app&inbjudan=accepterad" : "/app");
        router.refresh();
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "SIGN_IN_AS_INVITED_USER_REQUIRED") {
        setError("E-postadressen har redan ett konto. Logga in med det kontot och öppna länken igen.");
      } else if (body?.error === "ACCOUNT_DETAILS_REQUIRED") {
        setError("Fyll i namn och ett lösenord med minst 12 tecken.");
      } else {
        setError("Inbjudan är ogiltig, återkallad eller har gått ut.");
      }
    } catch {
      setError("Det gick inte att acceptera inbjudan just nu.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <Field label="Namn" hint="Behövs bara om du inte redan har ett konto." name="name" autoComplete="name" />
      <Field label="Välj lösenord" hint="Minst 12 tecken. Lämna tomt om du redan är inloggad." name="password" type="password" autoComplete="new-password" minLength={12} />
      <Field label="Bekräfta lösenord" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} />
      <button type="submit" disabled={pending} className={`${primaryButtonClassName} w-full`}>{pending ? "Kontrollerar…" : "Acceptera inbjudan"}</button>
      <Link href={`/logga-in?next=${encodeURIComponent(`/inbjudan/${token}`)}`} className="inline-flex min-h-11 w-full items-center justify-center font-semibold text-[var(--primary)] hover:underline">Har du redan ett konto? Logga in</Link>
    </form>
  );
}
