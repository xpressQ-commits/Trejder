"use client";

import { useState, type FormEvent } from "react";
import {
  FormMessage,
  primaryButtonClassName,
} from "@/components/ui/form-controls";

export function CompanyLogoForm({ hasLogo }: { hasLogo: boolean }) {
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const response = await fetch("/api/company/profile/logo", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    if (response.ok) {
      setVersion((value) => value + 1);
      setMessage({ type: "success", text: "Företagslogotypen har sparats." });
      event.currentTarget.reset();
    } else {
      setMessage({
        type: "error",
        text: "Logotypen kunde inte sparas. Använd JPEG, PNG eller WebP under 10 MB.",
      });
    }
    setPending(false);
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div>
        <h3 className="text-lg font-semibold">Företagslogotyp</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Logotypen används automatiskt i nya PDF-avtal och optimeras vid uppladdning.
        </p>
      </div>
      {message ? <FormMessage type={message.type}>{message.text}</FormMessage> : null}
      {hasLogo || version ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/company/profile/logo?v=${version}`}
          alt="Företagslogotyp"
          className="max-h-24 max-w-sm rounded-lg border border-[var(--border)] bg-white object-contain p-3"
        />
      ) : null}
      <label className="block font-medium">
        Välj logotyp
        <input
          className="mt-2 block w-full text-sm"
          type="file"
          name="logo"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <button className={primaryButtonClassName} disabled={pending}>
        {pending ? "Laddar upp…" : hasLogo || version ? "Byt logotyp" : "Ladda upp logotyp"}
      </button>
    </form>
  );
}
