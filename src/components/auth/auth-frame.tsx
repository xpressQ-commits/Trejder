import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function AuthFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Link href="/logga-in" aria-label="Trejder" className="mb-10 inline-flex"><BrandLogo /></Link>
        <section aria-labelledby="auth-title">
          <p className="text-sm font-semibold text-[var(--success)]">{eyebrow}</p>
          <h1 id="auth-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-3 text-[var(--muted)]">{description}</p>
          <div className="mt-7">{children}</div>
        </section>
        <p className="mt-10 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">Åtkomst ges endast till användare som bjudits in av ett godkänt bilhandelsföretag.</p>
      </div>
    </main>
  );
}
