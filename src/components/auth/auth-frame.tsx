import Link from "next/link";
import type { ReactNode } from "react";

export function AuthFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Link href="/logga-in" className="mb-8 inline-flex min-h-11 items-center text-xl font-semibold tracking-tight">Handlarbörsen</Link>
        <section aria-labelledby="auth-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-[var(--primary)]">{eyebrow}</p>
          <h1 id="auth-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-3 text-[var(--muted)]">{description}</p>
          <div className="mt-7">{children}</div>
        </section>
        <p className="mt-5 text-sm text-[var(--muted)]">Åtkomst ges endast till användare som bjudits in av ett godkänt bilhandelsföretag.</p>
      </div>
    </main>
  );
}
