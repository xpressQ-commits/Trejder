"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Handshake } from "lucide-react";
import { primaryButtonClassName } from "@/components/ui/form-controls";

export function StartChatButton({
  bidId,
  canStart,
}: {
  bidId: string;
  canStart: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (!canStart) return null;
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          const response = await fetch("/api/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bidId }),
          });
          if (response.ok) {
            const result = (await response.json()) as {
              thread: { id: string; matchId: string };
            };
            router.push(`/app/affarer/${result.thread.matchId}`);
          } else {
            setError(true);
            setPending(false);
          }
        }}
        className={primaryButtonClassName}
      >
        <Handshake className="mr-2" size={18} />
        {pending ? "Öppnar…" : "Öppna affär"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          Affären kunde inte öppnas.
        </p>
      ) : null}
    </div>
  );
}
