import Link from "next/link";
import { AccountApplicationForm } from "@/components/auth/account-application-form";
import { BrandLogo } from "@/components/brand-logo";

export default function AccountApplicationPage() {
  return <main className="min-h-screen bg-[var(--surface-subtle)] px-5 py-10 sm:px-6">
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/logga-in" aria-label="Trejder" className="mb-10 inline-flex"><BrandLogo /></Link>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-[var(--success)]">För bilhandlare</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ansök om konto</h1>
        <p className="mt-3 text-[var(--muted)]">Fyll i företagets uppgifter. Vi granskar ansökan och återkommer inom 48 timmar.</p>
        <div className="mt-7"><AccountApplicationForm /></div>
      </section>
      <p className="mt-6 text-center text-sm"><Link href="/logga-in" className="font-semibold text-[var(--primary)] hover:underline">Tillbaka till inloggningen</Link></p>
    </div>
  </main>;
}
