import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/app-shell/session-controls";
import { BrandLogo } from "@/components/brand-logo";
import { requirePlatformAdmin } from "@/server/platform-admin";

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  let user;
  try { user = await requirePlatformAdmin(await headers()); }
  catch { redirect("/app"); }
  return <div className="min-h-screen bg-[var(--background)]">
    <header className="border-b border-[var(--border)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3"><Link href="/admin" aria-label="Trejder superadmin"><BrandLogo compact /></Link><div><p className="text-lg font-semibold tracking-[-0.03em]">Trejder superadmin</p><p className="text-sm text-[var(--muted)]">{user.email}</p></div></div>
        <div className="flex items-center gap-3"><Link href="/app" className="min-h-11 rounded-lg px-3 py-2.5 font-semibold hover:bg-slate-100">Till marknaden</Link><LogoutButton compact /></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
  </div>;
}
