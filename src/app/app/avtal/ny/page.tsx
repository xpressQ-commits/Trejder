import { AgreementForm } from "@/components/agreements/agreement-form";
import { serializeAgreementDeal } from "@/components/agreements/types";
import { getCurrentAgreementContext } from "@/app/app/_lib/current-context";
import { getCompanyContact } from "@/server/company/profile";
import { listAgreementDealOptions } from "@/server/agreements";

export default async function NewAgreementPage() {
  const context = await getCurrentAgreementContext();
  const [contact, deals] = await Promise.all([
    getCompanyContact(context.company.id),
    listAgreementDealOptions(context.company.id),
  ]);
  return <section><p className="text-sm font-semibold text-[var(--primary)]">Nytt avtal</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Skapa fordonsavtal</h1><p className="mt-2 text-[var(--muted)]">Spara först som utkast, kontrollera förhandsgranskningen och skapa därefter den låsta PDF-filen.</p><div className="mt-8"><AgreementForm company={{ legalName: context.company.legalName, organizationNumber: context.company.organizationNumber, ...contact }} deals={deals.map(serializeAgreementDeal)} /></div></section>;
}
