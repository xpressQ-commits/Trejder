import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { BrandLogo } from "@/components/brand-logo";
import {
  LogoutButton,
  SelectCompany,
} from "@/components/app-shell/session-controls";
import {
  ACTIVE_COMPANY_COOKIE,
  getAuthenticatedUser,
  listActiveCompanyContexts,
} from "@/server/company/context";
import { hasPlatformAdminAuthority } from "@/server/platform-admin";
import { countUnreadChatMessages } from "@/server/chat";
import { listUserNotifications } from "@/server/notifications";

export default async function DealerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAuthenticatedUser(await headers());
  if (!user) redirect("/logga-in?next=/app");
  const companies = await listActiveCompanyContexts(user.id);
  const selectedId = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  const selected = companies.find(
    (company) => company.companyId === selectedId,
  );
  const [isPlatformAdmin, notifications, unreadChatCount] = await Promise.all([
    hasPlatformAdminAuthority(user.id),
    listUserNotifications(user.id),
    selected ? countUnreadChatMessages(selected.companyId) : Promise.resolve(0),
  ]);

  if (companies.length === 0)
    return (
      <AccessState
        title="Ingen aktiv företagsåtkomst"
        description="Ditt konto saknar ett aktivt medlemskap. Kontakta företagets administratör."
      >
        <LogoutButton />
      </AccessState>
    );
  if (!selected)
    return (
      <AccessState
        title="Välj företag"
        description={
          companies.length === 1
            ? "Fortsätt till företaget för att skapa en säker företagskontext."
            : "Välj vilket företag du vill arbeta i."
        }
      >
        <SelectCompany companies={companies} />
      </AccessState>
    );

  return (
    <AppShell
      userName={user.name}
      companyName={selected.legalName}
      companyId={selected.companyId}
      role={selected.role}
      companies={companies}
      isPlatformAdmin={isPlatformAdmin}
      isStaging={process.env.APP_ENV === "staging"}
      initialNotifications={notifications.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt?.toISOString() ?? null,
      }))}
      initialUnreadChatCount={unreadChatCount}
    >
      {children}
    </AppShell>
  );
}

function AccessState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <BrandLogo compact />
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 mb-6 text-[var(--muted)]">{description}</p>
        {children}
      </section>
    </main>
  );
}
