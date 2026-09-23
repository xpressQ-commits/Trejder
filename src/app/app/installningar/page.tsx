import { LogoutButton } from "@/components/app-shell/session-controls";

export default function SettingsPage() {
  return <section aria-labelledby="settings-title"><p className="text-sm font-semibold text-[var(--primary)]">Konto</p><h1 id="settings-title" className="mt-1 text-3xl font-semibold tracking-tight">Inställningar</h1><div className="mt-7 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Aktuell session</h2><p className="mt-2 mb-5 max-w-xl text-[var(--muted)]">Logga ut när du är klar, särskilt om du använder en delad enhet.</p><LogoutButton /></div></section>;
}
