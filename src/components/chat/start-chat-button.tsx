"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
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
              thread: { id: string };
            };
            router.push(`/app/chattar?thread=${result.thread.id}`);
          } else {
            setError(true);
            setPending(false);
          }
        }}
        className={primaryButtonClassName}
      >
        <MessageCircle className="mr-2" size={18} />
        {pending ? "Öppnar…" : "Öppna chat"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          Chatten kunde inte öppnas.
        </p>
      ) : null}
    </div>
  );
}
