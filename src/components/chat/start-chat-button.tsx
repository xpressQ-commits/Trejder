"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { primaryButtonClassName } from "@/components/ui/form-controls";

export function StartChatButton({ listingId, canStart }: { listingId: string; canStart: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (!canStart) return <p className="text-sm text-[var(--muted)]">Du behöver rollen administratör eller handlare för att starta en chatt.</p>;
  return <div><button type="button" disabled={pending} onClick={async () => {
    setPending(true); setError(false);
    const response = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
    if (response.ok) {
      const result = (await response.json()) as { thread: { id: string } };
      router.push(`/app/chattar?thread=${result.thread.id}`);
    } else { setError(true); setPending(false); }
  }} className={primaryButtonClassName}><MessageCircle className="mr-2" size={18} />{pending ? "Öppnar…" : "Ställ en fråga"}</button>{error ? <p role="alert" className="mt-2 text-sm text-[var(--danger)]">Chatten kunde inte öppnas.</p> : null}</div>;
}
