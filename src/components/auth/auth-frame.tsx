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
          <div className="mt-2 flex items-center justify-between gap-6"><h1 id="auth-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>{title === "Logga in" ? <Link href="/ansok-om-konto" className="shrink-0 font-semibold text-[var(--primary)] hover:underline">Ansök om konto</Link> : null}</div>
          <p className="mt-3 text-[var(--muted)]">{description}</p>
          <div className="mt-7">{children}</div>
        </section>
        <p className="mt-10 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">Trejder sammanför bilägare med verifierade bilhandlare.</p>
      </div>
    </main>
  );
}
