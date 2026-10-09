"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  Field,
  FormMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
  SelectField,
} from "@/components/ui/form-controls";

type Role = "admin" | "trader" | "viewer" | "private_customer";
type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: "active" | "suspended" | "revoked";
};
type Invitation = {
  id: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string | Date;
};

const roleLabels: Record<Role, string> = {
  admin: "Administratör",
  trader: "Handlare",
  viewer: "Läsbehörighet",
  private_customer: "Privatkund",
};
const statusLabels = {
  active: "Aktiv",
  suspended: "Pausad",
  revoked: "Återkallad",
} as const;

export function MemberAdmin({
  initialMembers,
  initialInvitations,
  billingExempt = false,
}: {
  initialMembers: Member[];
  initialInvitations: Invitation[];
  billingExempt?: boolean;
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] =
    useState<Invitation[]>(initialInvitations);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();
  const [pendingId, setPendingId] = useState<string>();
  const activeMembers = members.filter(
    (member) => member.status === "active",
  ).length;

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/company/members");
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { members: Member[] };
      setMembers(body.members);
    } catch {
      setMessage({
        type: "error",
        text: "Användarna kunde inte hämtas.",
      });
    }
  }, []);

  async function loadInvitations() {
    const response = await fetch("/api/company/invitations");
    if (response.ok) {
      setInvitations(
        ((await response.json()) as { invitations: Invitation[] }).invitations,
      );
    }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setPendingId("invite");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/company/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"),
        role: data.get("role"),
      }),
    });
    if (response.ok) {
      form.reset();
      setMessage({ type: "success", text: "Inbjudan är skickad." });
      await loadInvitations();
    } else {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage({ type: "error", text: invitationError(body?.error) });
    }
    setPendingId(undefined);
  }

  async function revokeInvitation(invitation: Invitation) {
    if (!window.confirm(`Återkalla inbjudan till ${invitation.email}?`)) return;
    setPendingId(invitation.id);
    const response = await fetch(`/api/company/invitations/${invitation.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setMessage({ type: "success", text: "Inbjudan är återkallad." });
      await loadInvitations();
    } else {
      setMessage({
        type: "error",
        text: "Inbjudan kunde inte återkallas.",
      });
    }
    setPendingId(undefined);
  }

  async function update(
    member: Member,
    change: { role?: Role; status?: Member["status"]; phone?: string },
  ) {
    if (
      change.status === "revoked" &&
      !window.confirm(`Återkalla åtkomsten för ${member.name}?`)
    ) {
      return;
    }
    setPendingId(member.id);
    setMessage(undefined);
    const response = await fetch(`/api/company/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    if (response.ok) {
      setMessage({ type: "success", text: "Användaren är uppdaterad." });
      await load();
    } else {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage({
        type: "error",
        text:
          body?.error === "LAST_ACTIVE_ADMIN"
            ? "Företaget måste ha minst en aktiv administratör."
            : "Användaren kunde inte uppdateras.",
      });
    }
    setPendingId(undefined);
  }

  return (
    <div className="space-y-7">
      {message ? (
        <FormMessage type={message.type}>{message.text}</FormMessage>
      ) : null}

      <section
        aria-labelledby="invite-title"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
      >
        <h3 id="invite-title" className="text-lg font-semibold">
          Bjud in användare
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {billingExempt
            ? "Trejder internkonto har obegränsat antal användare utan extra kostnad."
            : "Två aktiva användare ingår. Varje ytterligare aktiv användare kostar 199 kr per månad exklusive moms."}
        </p>
        {!billingExempt ? (
          <p className="mt-2 text-sm font-medium">
            {activeMembers} aktiva användare.{" "}
            {activeMembers < 2
              ? "Nästa aktiva användare ingår."
              : "Nästa aktiva användare lägger till 199 kr/mån exkl. moms."}
          </p>
        ) : null}
        <form
          onSubmit={invite}
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
        >
          <Field
            label="E-postadress"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <SelectField label="Roll" name="role" defaultValue="trader">
            <option value="admin">Administratör</option>
            <option value="trader">Handlare</option>
            <option value="viewer">Läsbehörighet</option>
          </SelectField>
          <button
            type="submit"
            disabled={pendingId === "invite"}
            className={primaryButtonClassName}
          >
            {pendingId === "invite" ? "Skickar…" : "Skicka inbjudan"}
          </button>
        </form>
      </section>

      {invitations.some((invitation) => invitation.status === "pending") ? (
        <section aria-labelledby="invitations-title">
          <h3 id="invitations-title" className="text-xl font-semibold">
            Väntande inbjudningar
          </h3>
          <ul className="mt-4 space-y-3">
            {invitations
              .filter((invitation) => invitation.status === "pending")
              .map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-semibold">{invitation.email}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {roleLabels[invitation.role]} · gäller till{" "}
                      {new Intl.DateTimeFormat("sv-SE", {
                        dateStyle: "medium",
                        timeZone: "Europe/Stockholm",
                      }).format(new Date(invitation.expiresAt))}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pendingId === invitation.id}
                    onClick={() => void revokeInvitation(invitation)}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 font-semibold text-[var(--danger)] hover:bg-[var(--danger-surface)]"
                  >
                    Återkalla
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="members-title">
        <h3 id="members-title" className="text-xl font-semibold">
          Företagets användare
        </h3>
        <ul className="mt-4 space-y-3">
          {members.map((member) => (
            <li
              key={member.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)]">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{member.name}</p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {member.email}
                  </p>
                  <p className="mt-1 text-sm">{statusLabels[member.status]}</p>
                  <form
                    className="mt-4 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void update(member, {
                        phone: String(data.get("phone") ?? ""),
                      });
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <Field
                        label="Telefonnummer"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        defaultValue={member.phone ?? ""}
                        minLength={5}
                        maxLength={40}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={pendingId === member.id}
                      className={secondaryButtonClassName}
                    >
                      Spara telefon
                    </button>
                  </form>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
                  <SelectField
                    label="Roll"
                    value={member.role}
                    disabled={
                      pendingId === member.id || member.status !== "active"
                    }
                    onChange={(event) =>
                      void update(member, {
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
                        disabled={pendingId === member.id}
                        onClick={() =>
                          void update(member, { status: "suspended" })
                        }
                        className={secondaryButtonClassName}
                      >
                        Pausa
                      </button>
                      <button
                        type="button"
                        disabled={pendingId === member.id}
                        onClick={() =>
                          void update(member, { status: "revoked" })
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 font-semibold text-[var(--danger)] hover:bg-[var(--danger-surface)]"
                      >
                        Återkalla
                      </button>
                    </>
                  ) : member.status === "suspended" ? (
                    <button
                      type="button"
                      disabled={pendingId === member.id}
                      onClick={() => void update(member, { status: "active" })}
                      className={secondaryButtonClassName}
                    >
                      Återaktivera
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function invitationError(code?: string) {
  if (code === "PENDING_INVITATION_EXISTS") {
    return "Det finns redan en väntande inbjudan till adressen.";
  }
  if (code === "MEMBERSHIP_ALREADY_EXISTS") {
    return "Personen är redan medlem i företaget.";
  }
  return "Inbjudan kunde inte skickas. Kontrollera adressen och försök igen.";
}
