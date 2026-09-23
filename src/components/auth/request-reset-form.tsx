"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";

export function RequestResetForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), redirectTo: "/aterstall-losenord" }),
      });
    } finally {
      setPending(false);
      setSent(true);
    }
  }

  if (sent) {
    return <div className="space-y-5"><FormMessage type="success">Om adressen tillhör ett konto skickar vi instruktioner dit.</FormMessage><Link className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)] hover:underline" href="/logga-in">Tillbaka till inloggningen</Link></div>;
  }

  return <form onSubmit={submit} className="space-y-5"><Field label="E-postadress" name="email" type="email" autoComplete="email" inputMode="email" required /><button type="submit" disabled={pending} className={`${primaryButtonClassName} w-full`}>{pending ? "Skickar…" : "Skicka återställningslänk"}</button><Link className="inline-flex min-h-11 w-full items-center justify-center font-semibold text-[var(--primary)] hover:underline" href="/logga-in">Avbryt</Link></form>;
}
