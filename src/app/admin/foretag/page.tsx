import Link from "next/link";
import { listPlatformCompaniesPage } from "@/server/platform-companies";
import {
  formatAdminDate,
  subscriptionStatusLabel,
  type PlatformCompanyListItem,
} from "@/components/platform/subscription-view-model";
import { inputClassName, primaryButtonClassName } from "@/components/ui/form-controls";

export const dynamic = "force-dynamic";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `/admin/foretag?${value}` : "/admin/foretag";
}

function StatusBadge({ company }: { company: PlatformCompanyListItem }) {
  const tone =
    company.subscription.status === "premium"
      ? "border-[var(--success)] bg-[var(--success-surface)] text-[var(--success)]"
      : company.subscription.status === "unpaid"
        ? "border-[var(--danger)] bg-[var(--danger-surface)] text-[var(--danger)]"
        : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)]";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold ${tone}`}>
      {subscriptionStatusLabel(company.subscription.status)}
    </span>
  );
}

export default async function PlatformCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = (single(params.q) ?? "").trim().slice(0, 100);
  const requestedPage = Number(single(params.page) ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = await listPlatformCompaniesPage({ query, page, pageSize: 20 });
  const companies: PlatformCompanyListItem[] = result.companies.map((company) => ({
    id: company.id,
    legalName: company.legalName,
    organizationNumber: company.organizationNumber,
    contactPhone: company.contactPhone,
    activeUserCount: company.activeUsers,
    includedUserCount: company.includedUsers,
    extraBillableUserCount: company.extraUsers,
    subscription: {
      status: ({ GRATIS: "free", PREMIUM: "premium", OBETALD: "unpaid" } as const)[company.status],
      source: company.source,
      freeUntil: company.freeAccessEndsAt,
      stripeStatus: company.stripeStatus,
    },
  }));

  return (
    <section aria-labelledby="companies-title">
      <p className="text-sm font-semibold text-[var(--primary)]">Global administration</p>
      <div className="mt-1 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 id="companies-title" className="text-3xl font-semibold tracking-tight">Företag</h1>
          <p className="mt-2 text-[var(--muted)]">Abonnemang, aktiva användare och faktureringsstatus för alla bilhandlare.</p>
        </div>
        <Link href="/admin" className="font-semibold text-[var(--primary)] underline decoration-transparent underline-offset-4 hover:decoration-current">Skapa företag och hantera behörigheter</Link>
      </div>

      <form action="/admin/foretag" method="get" role="search" className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex sm:items-end sm:gap-3">
        <label htmlFor="company-search" className="block flex-1 font-medium">
          Sök företag
          <input id="company-search" name="q" type="search" maxLength={100} defaultValue={query} placeholder="Namn, organisationsnummer eller telefon" className={inputClassName} />
        </label>
        <button className={`${primaryButtonClassName} mt-3 w-full sm:mt-0 sm:w-auto`}>Sök</button>
        {query ? <Link href="/admin/foretag" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 font-semibold text-[var(--muted)] hover:bg-[var(--surface-subtle)] sm:mt-0 sm:w-auto">Rensa</Link> : null}
      </form>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--muted)]">{result.total === 1 ? "1 företag" : `${result.total} företag`}</p>
        <p className="text-sm text-[var(--muted)]">Sida {result.page} av {Math.max(result.totalPages, 1)}</p>
      </div>

      {companies.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-semibold">Inga företag hittades</h2>
          <p className="mt-1 text-[var(--muted)]">Prova ett annat namn, organisationsnummer eller telefonnummer.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {companies.map((company) => (
            <li key={company.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.7fr)_minmax(12rem,1fr)_auto] lg:items-center">
                <div>
                  <h2 className="font-semibold">{company.legalName}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Org.nr {company.organizationNumber}</p>
                  {company.contactPhone ? <p className="text-sm text-[var(--muted)]">{company.contactPhone}</p> : null}
                </div>
                <div>
                  <StatusBadge company={company} />
                  {company.subscription.status === "free" ? <p className="mt-1.5 text-sm text-[var(--muted)]">Gratis till {formatAdminDate(company.subscription.freeUntil)}</p> : null}
                  {company.subscription.stripeStatus ? <p className="mt-1.5 text-sm text-[var(--muted)]">Stripe: {company.subscription.stripeStatus}</p> : null}
                </div>
                <div className="text-sm">
                  <p><span className="font-semibold">{company.activeUserCount}</span> aktiva användare</p>
                  <p className="text-[var(--muted)]">{company.includedUserCount} ingår · {company.extraBillableUserCount} extra</p>
                </div>
                <Link href={`/admin/foretag/${company.id}`} className={primaryButtonClassName}>Hantera</Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Sidindelning" className="mt-6 flex items-center justify-between gap-4">
          {result.page > 1 ? <Link href={pageHref(query, result.page - 1)} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold hover:bg-[var(--surface-subtle)]">Föregående</Link> : <span />}
          {result.page < result.totalPages ? <Link href={pageHref(query, result.page + 1)} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold hover:bg-[var(--surface-subtle)]">Nästa</Link> : null}
        </nav>
      ) : null}
    </section>
  );
}
