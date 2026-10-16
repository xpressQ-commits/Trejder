"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, LoaderCircle } from "lucide-react";
import { secondaryButtonClassName } from "@/components/ui/form-controls";

export function DuplicateAgreementButton({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function duplicate() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/agreements/${agreementId}/duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => null)) as
        | { agreement?: { id: string }; error?: string }
        | null;
      if (!response.ok || !body?.agreement) throw new Error(body?.error);
      router.push(`/app/avtal/${body.agreement.id}/redigera`);
      router.refresh();
    } catch {
      setError("Avtalet kunde inte dupliceras.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={duplicate}
        disabled={pending}
        className={secondaryButtonClassName}
      >
        {pending ? <LoaderCircle className="mr-2 animate-spin" size={17} /> : <Copy className="mr-2" size={17} />}
        Duplicera som nytt avtal
      </button>
      {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
