"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FormMessage, primaryButtonClassName } from "@/components/ui/form-controls";

export function PrivateVerification({ token }: { token: string }) {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  useEffect(() => { void fetch("/api/private-registration", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then((response) => setState(response.ok ? "done" : "error")).catch(() => setState("error")); }, [token]);
  if (state === "working") return <p role="status">Verifierar kontot…</p>;
  if (state === "error") return <FormMessage type="error">Länken är ogiltig, har gått ut eller har redan använts.</FormMessage>;
  return <div className="space-y-5"><FormMessage type="success">Kontot är verifierat och klart.</FormMessage><Link href="/logga-in" className={primaryButtonClassName}>Logga in</Link></div>;
}
