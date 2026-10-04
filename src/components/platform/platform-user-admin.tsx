"use client";

import { useState, type FormEvent } from "react";
import { Field, FormMessage, primaryButtonClassName, secondaryButtonClassName, SelectField } from "@/components/ui/form-controls";

type Status = "pending" | "approved" | "rejected";
type Application = { id: string; firstName: string; lastName: string; companyName: string; organizationNumber: string; phone: string; email: string; status: Status; createdAt: string | Date; reviewedAt: string | Date | null };
type Company = { id: string; legalName: string; status: "active" | "suspended" };
const tabs: Array<{ status: Status; label: string }> = [{ status: "pending", label: "Väntande" }, { status: "approved", label: "Godkända" }, { status: "rejected", label: "Avböjda" }];

export function PlatformUserAdmin({ initialApplications, companies }: { initialApplications: Application[]; companies: Company[] }) {
  const [applications, setApplications] = useState(initialApplications);
  const [tab, setTab] = useState<Status>("pending");
  const [pending, setPending] = useState<string>();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string }>();

  async function decide(application: Application, decision: "approve" | "reject") {
    const verb = decision === "approve" ? "godkänna" : "avböja";
    if (!window.confirm(`Vill du ${verb} ansökan från ${application.companyName}?`)) return;
    setPending(application.id); setMessage(undefined);
    const response = await fetch(`/api/platform/account-applications/${application.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
    });
    const body = (await response.json().catch(() => null)) as { application?: Application; error?: string } | null;
    if (response.ok && body?.application) {
      setApplications((current) => current.map((item) => item.id === application.id ? body.application! : item));
      setMessage({ type: "success", text: decision === "approve" ? "Företaget skapades och inbjudan skickades från konto@trejder.se." : "Ansökan avböjdes och beskedet skickades." });
    } else {
      setMessage({ type: "error", text: body?.error === "ORGANIZATION_NUMBER_EXISTS" ? "Organisationsnumret finns redan. Kontrollera företaget innan du försöker igen." : "Beslutet kunde inte sparas eller mejlet kunde inte skickas." });
    }
    setPending(undefined);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const companyId = String(data.get("companyId") ?? "");
    setPending("create-account"); setMessage(undefined);
    const response = await fetch(`/api/platform/companies/${companyId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password"), role: data.get("role") }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.ok) { form.reset(); setMessage({ type: "success", text: "Kontot har skapats och kan användas direkt." }); }
    else setMessage({ type: "error", text: body?.error === "USER_EMAIL_EXISTS" ? "Mejladressen har redan ett konto." : "Kontot kunde inte skapas." });
    setPending(undefined);
  }

  const visible = applications.filter((application) => application.status === tab);
  return <div className="space-y-8">
    {message ? <FormMessage type={message.type}>{message.text}</FormMessage> : null}
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Kontoansökningar</h2>
      <div className="mt-5 flex gap-2 border-b border-[var(--border)]" role="tablist">{tabs.map(({ status, label }) => <button key={status} type="button" role="tab" aria-selected={tab === status} onClick={() => setTab(status)} className={`min-h-11 border-b-2 px-4 font-semibold ${tab === status ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)]"}`}>{label} ({applications.filter((item) => item.status === status).length})</button>)}</div>
      {visible.length === 0 ? <p className="py-10 text-center text-[var(--muted)]">Inga {tabs.find((item) => item.status === tab)?.label.toLowerCase()} ansökningar.</p> : <ul className="mt-5 space-y-4">{visible.map((application) => <li key={application.id} className="rounded-xl border border-[var(--border)] p-4 sm:p-5"><div className="flex flex-col justify-between gap-5 md:flex-row"><dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2"><ApplicationField label="Namn" value={`${application.firstName} ${application.lastName}`} /><ApplicationField label="Företag" value={application.companyName} /><ApplicationField label="Organisationsnummer" value={application.organizationNumber} /><ApplicationField label="Telefon" value={application.phone} /><ApplicationField label="Mejl" value={application.email} /><ApplicationField label="Inkommen" value={new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(application.createdAt))} /></dl>{application.status === "pending" ? <div className="flex shrink-0 gap-3 md:items-start"><button type="button" disabled={pending === application.id} onClick={() => void decide(application, "approve")} className={primaryButtonClassName}>Godkänn</button><button type="button" disabled={pending === application.id} onClick={() => void decide(application, "reject")} className={secondaryButtonClassName}>Avböj</button></div> : null}</div></li>)}</ul>}
    </section>
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Skapa användarkonto direkt</h2><p className="mt-1 text-sm text-[var(--muted)]">Välj ett befintligt företag. Kontot blir verifierat och aktivt utan inbjudan.</p><form onSubmit={createAccount} className="mt-5 grid gap-4 md:grid-cols-2"><SelectField label="Företag" name="companyId" required defaultValue=""><option value="" disabled>Välj företag</option>{companies.filter((company) => company.status === "active").map((company) => <option key={company.id} value={company.id}>{company.legalName}</option>)}</SelectField><SelectField label="Roll" name="role" defaultValue="trader"><option value="admin">Administratör</option><option value="trader">Handlare</option><option value="viewer">Läsbehörighet</option></SelectField><Field label="Mejladress" name="email" type="email" required maxLength={320} /><Field label="Lösenord" name="password" type="password" required minLength={12} maxLength={128} /><div className="md:col-span-2"><button className={primaryButtonClassName} disabled={pending === "create-account"}>{pending === "create-account" ? "Skapar…" : "Skapa konto"}</button></div></form></section>
  </div>;
}

function ApplicationField({ label, value }: { label: string; value: string }) { return <div><dt className="text-[var(--muted)]">{label}</dt><dd className="mt-0.5 font-semibold break-words">{value}</dd></div>; }
