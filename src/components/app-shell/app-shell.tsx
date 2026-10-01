import { Building2, CarFront, Settings, Store, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CompanySwitcher, LogoutButton } from "@/components/app-shell/session-controls";

type CompanyOption = { companyId: string; legalName: string };

export function AppShell({ children, userName, companyName, companyId, role, companies }: { children: ReactNode; userName: string; companyName: string; companyId: string; role: "admin" | "trader" | "viewer"; companies: CompanyOption[] }) {
  const navigation = [
    { href: "/app/marknad", label: "Marknad", icon: Store },
    { href: "/app/bilar", label: "Mina bilar", icon: CarFront },
    { href: "/app/foretag", label: "Företag", icon: Building2 },
    ...(role === "admin" ? [{ href: "/app/anvandare", label: "Användare", icon: Users }] : []),
    { href: "/app/installningar", label: "Inställningar", icon: Settings },
  ];
  return <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[16rem_1fr]">
    <aside className="border-b border-[var(--border)] bg-white lg:min-h-screen lg:border-r lg:border-b-0">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:block lg:px-5 lg:py-6">
        <Link href="/app/marknad" className="inline-flex min-h-11 items-center text-xl font-semibold tracking-[-0.04em] text-[#16211b]">Trejder</Link>
        <div className="lg:hidden"><LogoutButton compact /></div>
        <div className="mt-7 hidden lg:block"><CompanySwitcher companies={companies} selectedCompanyId={companyId} /></div>
        <nav aria-label="Huvudnavigation" className="mt-6 hidden lg:block"><ul className="space-y-1">{navigation.map(({ href, label, icon: Icon }) => <li key={href}><Link href={href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium hover:bg-slate-100"><Icon aria-hidden="true" size={19} />{label}</Link></li>)}</ul></nav>
        <div className="mt-8 hidden border-t border-[var(--border)] pt-5 lg:block"><p className="truncate text-sm font-semibold">{userName}</p><p className="truncate text-sm text-[var(--muted)]">{companyName}</p><div className="mt-3"><LogoutButton compact /></div></div>
      </div>
      <nav aria-label="Huvudnavigation mobil" className="overflow-x-auto border-t border-[var(--border)] lg:hidden"><ul className="mx-auto flex max-w-6xl px-2">{navigation.map(({ href, label, icon: Icon }) => <li key={href} className="flex-1"><Link href={href} className="flex min-h-14 min-w-20 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium"><Icon aria-hidden="true" size={18} />{label}</Link></li>)}</ul></nav>
    </aside>
    <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><div className="mx-auto max-w-5xl">{children}</div></main>
  </div>;
}
