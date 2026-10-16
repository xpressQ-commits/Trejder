import { notFound, redirect } from "next/navigation";
import { AgreementForm } from "@/components/agreements/agreement-form";
import { serializeAgreement, serializeAgreementDeal } from "@/components/agreements/types";
import { getCurrentAgreementContext } from "@/app/app/_lib/current-context";
import { getCompanyContact } from "@/server/company/profile";
import { getAgreement, listAgreementDealOptions } from "@/server/agreements";

export default async function EditAgreementPage({ params }: { params: Promise<{ agreementId: string }> }) {
  const context = await getCurrentAgreementContext();
  let current;
  try { current = await getAgreement(context.company.id, (await params).agreementId); } catch { notFound(); }
  if (current.status !== "draft") redirect(`/app/avtal/${current.id}`);
  const [contact, deals] = await Promise.all([getCompanyContact(context.company.id), listAgreementDealOptions(context.company.id)]);
  return <section><p className="text-sm font-semibold text-[var(--primary)]">Utkast · {current.agreementNumber}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Redigera avtal</h1><p className="mt-2 text-[var(--muted)]">Ett genererat avtal låses. Duplicera det senare om nya uppgifter behövs.</p><div className="mt-8"><AgreementForm company={{ legalName: context.company.legalName, organizationNumber: context.company.organizationNumber, ...contact }} deals={deals.map(serializeAgreementDeal)} initialAgreement={serializeAgreement(current)} /></div></section>;
}
