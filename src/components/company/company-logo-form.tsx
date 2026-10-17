"use client";

import { useRef, useState } from "react";
import {
  FormMessage,
  primaryButtonClassName,
} from "@/components/ui/form-controls";

export function CompanyLogoForm({
  hasLogo,
  onUploaded,
  embedded = false,
}: {
  hasLogo: boolean;
  onUploaded?: () => void;
  embedded?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();

  async function upload() {
    if (!file) {
      setMessage({ type: "error", text: "Välj en logotyp att ladda upp." });
      return;
    }
    setPending(true);
    setMessage(undefined);
    const body = new FormData();
    body.set("logo", file);
    try {
      const response = await fetch("/api/company/profile/logo", {
        method: "POST",
        body,
      });
      if (!response.ok) throw new Error("UPLOAD_FAILED");
      setVersion((value) => value + 1);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage({ type: "success", text: "Företagslogotypen har sparats och används i nya avtal." });
      onUploaded?.();
    } catch {
      setMessage({
        type: "error",
        text: "Logotypen kunde inte sparas. Använd JPEG, PNG eller WebP under 10 MB.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={
        embedded
          ? "space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
          : "mt-5 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      }
    >
      <div>
        <h3 className="text-lg font-semibold">Företagslogotyp</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Logotypen används automatiskt i nya PDF-avtal och optimeras vid uppladdning.
        </p>
      </div>
      {message ? <FormMessage type={message.type}>{message.text}</FormMessage> : null}
      {hasLogo || version > 0 ? (
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
          ref={inputRef}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        className={primaryButtonClassName}
        disabled={pending || !file}
        onClick={upload}
      >
        {pending ? "Laddar upp…" : hasLogo || version > 0 ? "Byt logotyp" : "Ladda upp logotyp"}
      </button>
    </div>
  );
}
