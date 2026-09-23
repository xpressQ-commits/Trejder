"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-controls";

type CompanyOption = { companyId: string; legalName: string };

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try { await fetch("/api/auth/sign-out", { method: "POST" }); } finally {
      router.replace("/logga-in");
      router.refresh();
    }
  }
  return <button type="button" onClick={logout} disabled={pending} className={compact ? "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-slate-100" : secondaryButtonClassName}><LogOut aria-hidden="true" size={18} />{pending ? "Loggar ut…" : "Logga ut"}</button>;
}

export function CompanySwitcher({ companies, selectedCompanyId }: { companies: CompanyOption[]; selectedCompanyId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function change(companyId: string) {
    setPending(true);
    const response = await fetch("/api/company-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
    if (response.ok) {
      router.push("/app");
      router.refresh();
    }
    else setPending(false);
  }
  if (companies.length < 2) return null;
  return <label className="block text-xs font-medium text-[var(--muted)]">Aktivt företag<select aria-label="Aktivt företag" disabled={pending} value={selectedCompanyId} onChange={(event) => void change(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--foreground)]">{companies.map((company) => <option key={company.companyId} value={company.companyId}>{company.legalName}</option>)}</select></label>;
}

export function SelectCompany({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function select(companyId: string) {
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/company-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setPending(false);
      setError(true);
    }
  }
  return <div className="space-y-3">{error ? <p role="alert" className="text-sm text-[var(--danger)]">Företaget kunde inte väljas.</p> : null}{companies.map((company) => <button key={company.companyId} type="button" disabled={pending} onClick={() => void select(company.companyId)} className={`${primaryButtonClassName} w-full`}>{company.legalName}</button>)}</div>;
}
