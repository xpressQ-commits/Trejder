import Link from "next/link";
import { FilePlus2, FileSignature, Download, ArrowRight } from "lucide-react";
import { getCurrentAgreementContext } from "@/app/app/_lib/current-context";
import { listAgreements } from "@/server/agreements";
import { formatDate, formatMoney } from "@/i18n";
import { getTranslations } from "@/i18n/server";
import { primaryButtonClassName } from "@/components/ui/form-controls";

export default async function AgreementsPage() {
  const context = await getCurrentAgreementContext();
  const { locale } = await getTranslations();
  const agreements = await listAgreements(context.company.id);
  const drafts = agreements.filter((item) => item.status === "draft");
  const generated = agreements.filter((item) => item.status !== "draft");

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--primary)]">Dokument</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Avtal</h1>
          <p className="mt-2 text-[var(--muted)]">Skapa, förhandsgranska och hantera köpeavtal för fordon.</p>
        </div>
        <Link href="/app/avtal/ny" className={primaryButtonClassName}><FilePlus2 className="mr-2" size={18} /> Skapa nytt avtal</Link>
      </div>
      {drafts.length || generated.length ? <div className="mt-9 space-y-10">
        <AgreementGroup title="Utkast" empty="Inga utkast." agreements={drafts} locale={locale} />
        <AgreementGroup title="Färdiga avtal" empty="Inga färdiga avtal." agreements={generated} locale={locale} />
      </div> : <div className="mt-9 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center"><FileSignature className="mx-auto text-[var(--muted)]" size={36} /><h2 className="mt-3 text-lg font-semibold">Inga avtal ännu</h2><p className="mt-1 text-[var(--muted)]">Skapa det första avtalet manuellt eller från en befintlig Trejder-affär.</p></div>}
    </section>
  );
}

type AgreementItem = Awaited<ReturnType<typeof listAgreements>>[number];

function AgreementGroup({ title, empty, agreements, locale }: { title: string; empty: string; agreements: AgreementItem[]; locale: "sv" | "en" }) {
  return <section><h2 className="text-xl font-semibold">{title}</h2>{agreements.length ? <div className="mt-4 grid gap-4 xl:grid-cols-2">{agreements.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{item.agreementNumber}</p><h3 className="mt-1 text-lg font-semibold">{item.vehicleSnapshot.makeModel}</h3><p className="text-sm text-[var(--muted)]">{item.vehicleSnapshot.registrationNumber} · {formatDate(locale, `${item.agreementDate}T12:00:00+02:00`)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "draft" ? "bg-[var(--warning-surface)] text-[var(--warning)]" : "bg-[var(--success-surface)] text-[var(--success)]"}`}>{item.status === "draft" ? "Utkast" : "Färdigt"}</span></div><p className="mt-4 text-xl font-semibold">{formatMoney(locale, item.totalAmountOre)}</p><div className="mt-4 flex flex-wrap gap-4"><Link href={item.status === "draft" ? `/app/avtal/${item.id}/redigera` : `/app/avtal/${item.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--primary)]">{item.status === "draft" ? "Fortsätt" : "Visa"} <ArrowRight size={16} /></Link>{item.pdfAvailable ? <a href={item.pdfUrl ?? "#"} className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--primary)]"><Download size={16} /> Ladda ner PDF</a> : null}</div></article>)}</div> : <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>}</section>;
}
