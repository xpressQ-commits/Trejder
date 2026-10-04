import { Building2, CarFront, MessageCircle, Settings, ShieldCheck, Store, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CompanySwitcher, LogoutButton } from "@/components/app-shell/session-controls";
import { BrandLogo } from "@/components/brand-logo";

type CompanyOption = { companyId: string; legalName: string };

export function AppShell({ children, userName, companyName, companyId, role, companies, isPlatformAdmin = false }: { children: ReactNode; userName: string; companyName: string; companyId: string; role: "admin" | "trader" | "viewer"; companies: CompanyOption[]; isPlatformAdmin?: boolean }) {
  const navigation = [
    { href: "/app/marknad", label: "Marknad", icon: Store },
    { href: "/app/bilar", label: "Mina bilar", icon: CarFront },
    { href: "/app/chattar", label: "Chattar", icon: MessageCircle },
    { href: "/app/foretag", label: "Företag", icon: Building2 },
    ...(role === "admin" ? [{ href: "/app/anvandare", label: "Användare", icon: Users }] : []),
    ...(isPlatformAdmin ? [{ href: "/admin", label: "Superadmin", icon: ShieldCheck }] : []),
    { href: "/app/installningar", label: "Inställningar", icon: Settings },
  ];
  return <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[16rem_1fr]">
    <aside className="border-b border-[#244943] bg-[#0f2e2a] text-white lg:min-h-screen lg:border-r lg:border-b-0">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:block lg:px-5 lg:py-6">
        <Link href="/app/marknad" aria-label="Trejder – marknaden" className="inline-flex items-center gap-3"><BrandLogo compact inverse /><span className="hidden text-xl font-semibold tracking-[-0.04em] sm:inline">Trejder</span></Link>
        <div className="lg:hidden"><LogoutButton compact /></div>
        <div className="mt-7 hidden lg:block"><CompanySwitcher companies={companies} selectedCompanyId={companyId} /></div>
        <nav aria-label="Huvudnavigation" className="mt-6 hidden lg:block"><ul className="space-y-1">{navigation.map(({ href, label, icon: Icon }) => <li key={href}><Link href={href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium text-white/90 transition-colors hover:bg-white/12 hover:text-white"><Icon aria-hidden="true" size={19} />{label}</Link></li>)}</ul></nav>
        <div className="mt-8 hidden border-t border-white/15 pt-5 lg:block"><p className="truncate text-sm font-semibold">{userName}</p><p className="truncate text-sm text-white/60">{companyName}</p><div className="mt-3"><LogoutButton compact /></div></div>
      </div>
      <nav aria-label="Huvudnavigation mobil" className="overflow-x-auto border-t border-white/15 lg:hidden"><ul className="mx-auto flex max-w-6xl px-2">{navigation.map(({ href, label, icon: Icon }) => <li key={href} className="flex-1"><Link href={href} className="flex min-h-14 min-w-20 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium text-white/85 hover:bg-white/10 hover:text-white"><Icon aria-hidden="true" size={18} />{label}</Link></li>)}</ul></nav>
    </aside>
    <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><div className="mx-auto max-w-5xl">{children}</div></main>
  </div>;
}
