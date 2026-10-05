"use client";

import { useState, type FormEvent } from "react";
import {
  Field,
  FormMessage,
  primaryButtonClassName,
} from "@/components/ui/form-controls";

export function CompanyContactForm({
  email,
  phone,
}: {
  email: string;
  phone: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/company/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactEmail: data.get("contactEmail"),
        contactPhone: data.get("contactPhone"),
      }),
    });
    setMessage(
      response.ok
        ? {
            type: "success",
            text: "Företagets kontaktuppgifter har sparats.",
          }
        : {
            type: "error",
            text: "Kontaktuppgifterna kunde inte sparas. Kontrollera uppgifterna och försök igen.",
          },
    );
    setPending(false);
  }

  return (
    <form
      onSubmit={submit}
      className="mt-7 space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">Kontaktuppgifter</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Dessa uppgifter blir synliga för motparten först när ett bud har
          accepterats.
        </p>
      </div>
      {message ? (
        <FormMessage type={message.type}>{message.text}</FormMessage>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="E-postadress"
          name="contactEmail"
          type="email"
          autoComplete="email"
          defaultValue={email}
          required
          maxLength={320}
        />
        <Field
          label="Telefonnummer"
          name="contactPhone"
          type="tel"
          autoComplete="tel"
          defaultValue={phone}
          required
          minLength={5}
          maxLength={40}
        />
      </div>
      <button className={primaryButtonClassName} disabled={pending}>
        {pending ? "Sparar…" : "Spara kontaktuppgifter"}
      </button>
    </form>
  );
}
