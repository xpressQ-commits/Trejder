"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  Field,
  FormMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
  SelectField,
} from "@/components/ui/form-controls";

type Company = {
  id: string;
  legalName: string;
  organizationNumber: string;
  contactEmail: string;
  status: "active" | "suspended";
  memberCount: number;
};
type Role = "admin" | "trader" | "viewer";
type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended" | "revoked";
};
const roleLabels: Record<Role, string> = {
  admin: "Administratör",
  trader: "Handlare",
  viewer: "Läsbehörighet",
};

export function PlatformCompanyAdmin({
  initialCompanies,
}: {
  initialCompanies: Company[];
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [selectedId, setSelectedId] = useState<string>();
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<string>();
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();
  const selected = companies.find((company) => company.id === selectedId);

  const loadCompanies = useCallback(async () => {
    const response = await fetch("/api/platform/companies");
    if (response.ok)
      setCompanies(
        ((await response.json()) as { companies: Company[] }).companies,
      );
  }, []);

  const loadMembers = useCallback(async (companyId: string) => {
    const response = await fetch(
      `/api/platform/companies/${companyId}/members`,
    );
    if (!response.ok) throw new Error();
    setMembers(((await response.json()) as { members: Member[] }).members);
  }, []);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("create");
    setMessage(undefined);
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/platform/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: data.get("legalName"),
        organizationNumber: data.get("organizationNumber"),
        contactEmail: data.get("contactEmail"),
      }),
    });
    if (response.ok) {
      form.reset();
      setMessage({ type: "success", text: "Företaget har skapats." });
      await loadCompanies();
    } else {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage({
        type: "error",
        text:
          body?.error === "ORGANIZATION_NUMBER_EXISTS"
            ? "Organisationsnumret används redan."
            : "Företaget kunde inte skapas.",
      });
    }
    setPending(undefined);
  }

  async function selectCompany(companyId: string) {
    setSelectedId(companyId);
    setPending(`load:${companyId}`);
    setMessage(undefined);
    try {
      await loadMembers(companyId);
    } catch {
      setMessage({ type: "error", text: "Användarna kunde inte hämtas." });
    }
    setPending(undefined);
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setPending("company");
    setMessage(undefined);
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/platform/companies/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: data.get("legalName"),
        organizationNumber: data.get("organizationNumber"),
        contactEmail: data.get("contactEmail"),
      }),
    });
    if (response.ok) {
      setMessage({ type: "success", text: "Företaget har uppdaterats." });
      await loadCompanies();
    } else
      setMessage({ type: "error", text: "Företaget kunde inte uppdateras." });
    setPending(undefined);
  }

  async function setCompanyStatus(status: Company["status"]) {
    if (!selected) return;
    if (
      status === "suspended" &&
      !window.confirm(
        `Pausa ${selected.legalName}? Alla användare förlorar åtkomsten tills företaget återaktiveras.`,
      )
    )
      return;
    setPending("company");
    setMessage(undefined);
    const response = await fetch(`/api/platform/companies/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      setMessage({
        type: "success",
        text:
          status === "active"
            ? "Företaget är återaktiverat."
            : "Företaget är pausat.",
      });
      await loadCompanies();
    } else
      setMessage({
        type: "error",
        text: "Företagsstatusen kunde inte ändras.",
      });
    setPending(undefined);
  }

  async function updateMember(
    member: Member,
    change: { role?: Role; status?: Member["status"] },
  ) {
    if (!selected) return;
    if (
      change.status === "revoked" &&
      !window.confirm(`Återkalla åtkomsten för ${member.name}?`)
    )
      return;
    setPending(member.id);
    setMessage(undefined);
    const response = await fetch(
      `/api/platform/companies/${selected.id}/members/${member.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      },
    );
    if (response.ok) {
      setMessage({ type: "success", text: "Behörigheten har uppdaterats." });
      await loadMembers(selected.id);
      await loadCompanies();
    } else
      setMessage({
        type: "error",
        text: "Behörigheten kunde inte uppdateras.",
      });
    setPending(undefined);
  }

  return (
    <div className="space-y-8">
      {message ? (
        <FormMessage type={message.type}>{message.text}</FormMessage>
      ) : null}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Lägg till företag</h2>
        <form
          onSubmit={createCompany}
          className="mt-5 grid gap-4 md:grid-cols-3"
        >
          <Field
            label="Juridiskt namn"
            name="legalName"
            required
            maxLength={200}
          />
          <Field
            label="Organisationsnummer"
            name="organizationNumber"
            required
            maxLength={20}
          />
          <Field
            label="Kontaktadress"
            name="contactEmail"
            type="email"
            required
            maxLength={320}
          />
          <div className="md:col-span-3">
            <button
              className={primaryButtonClassName}
              disabled={pending === "create"}
            >
              {pending === "create" ? "Skapar…" : "Skapa företag"}
            </button>
          </div>
        </form>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Alla företag</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {companies.map((company) => (
            <li
              key={company.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{company.legalName}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {company.organizationNumber} · {company.memberCount} aktiva
                    användare
                  </p>
                  <p
                    className={`mt-2 text-sm font-medium ${company.status === "active" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
                  >
                    {company.status === "active" ? "Aktivt" : "Pausat"}
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={pending === `load:${company.id}`}
                  onClick={() => void selectCompany(company.id)}
                >
                  Hantera
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {selected ? (
        <section className="space-y-7 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold">
              Hantera {selected.legalName}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ändringar loggas med ditt superadmin-konto.
            </p>
          </div>
          <form
            key={selected.id}
            onSubmit={saveCompany}
            className="grid gap-4 md:grid-cols-3"
          >
            <Field
              label="Juridiskt namn"
              name="legalName"
              defaultValue={selected.legalName}
              required
              maxLength={200}
            />
            <Field
              label="Organisationsnummer"
              name="organizationNumber"
              defaultValue={selected.organizationNumber}
              required
              maxLength={20}
            />
            <Field
              label="Kontaktadress"
              name="contactEmail"
              type="email"
              defaultValue={selected.contactEmail}
              required
              maxLength={320}
            />
            <div className="flex flex-wrap gap-3 md:col-span-3">
              <button
                className={primaryButtonClassName}
                disabled={pending === "company"}
              >
                Spara uppgifter
              </button>
              {selected.status === "active" ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 font-semibold text-[var(--danger)] hover:bg-red-50"
                  onClick={() => void setCompanyStatus("suspended")}
                >
                  Pausa företag
                </button>
              ) : (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => void setCompanyStatus("active")}
                >
                  Återaktivera företag
                </button>
              )}
            </div>
          </form>
          <div>
            <h3 className="text-lg font-semibold">Företagets användare</h3>
            {members.length === 0 ? (
              <p className="mt-3 text-[var(--muted)]">
                Företaget saknar användare.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--border)] p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {member.email} · {member.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <SelectField
                        label="Roll"
                        value={member.role}
                        disabled={
                          pending === member.id || member.status !== "active"
                        }
                        onChange={(event) =>
                          void updateMember(member, {
                            role: event.target.value as Role,
                          })
                        }
                      >
                        <option value="admin">{roleLabels.admin}</option>
                        <option value="trader">{roleLabels.trader}</option>
                        <option value="viewer">{roleLabels.viewer}</option>
                      </SelectField>
                      {member.status === "active" ? (
                        <>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            onClick={() =>
                              void updateMember(member, { status: "suspended" })
                            }
                          >
                            Pausa
                          </button>
                          <button
                            type="button"
                            className="min-h-11 rounded-lg px-3 font-semibold text-[var(--danger)] hover:bg-red-50"
                            onClick={() =>
                              void updateMember(member, { status: "revoked" })
                            }
                          >
                            Återkalla
                          </button>
                        </>
                      ) : member.status === "suspended" ? (
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={() =>
                            void updateMember(member, { status: "active" })
                          }
                        >
                          Återaktivera
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
