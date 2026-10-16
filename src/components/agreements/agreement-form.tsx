"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Eye, FileDown, LoaderCircle, Save } from "lucide-react";
import {
  agreementParties,
  calculateAgreementAmounts,
  calculatePaymentSummary,
  type AgreementCounterpartySnapshot,
  type AgreementFinanceAllocation,
  type AgreementHandoverSnapshot,
  type AgreementPaymentDetails,
  type AgreementVehicleSnapshot,
} from "@/domain/agreement";
import { DEFAULT_AGREEMENT_TERMS_SV } from "@/domain/agreement-terms";
import {
  FormMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-controls";
import type { AgreementDealOption, AgreementView } from "./types";

type CompanyProfile = {
  legalName: string;
  organizationNumber: string;
  contactEmail: string;
  contactPhone: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  vatNumber: string | null;
  hasLogo: boolean;
};

const blankCounterparty: AgreementCounterpartySnapshot = {
  kind: "company",
  firstName: "",
  lastName: "",
  personalIdentityNumber: "",
  companyName: "",
  organizationNumber: "",
  addressLine1: "",
  postalCode: "",
  city: "",
  contactPerson: "",
  phone: "",
  email: "",
};
const blankVehicle: AgreementVehicleSnapshot = {
  registrationNumber: "",
  makeModel: "",
  modelYear: null,
  mileageKm: null,
  vin: "",
  color: "",
  firstRegistrationDate: "",
};
const blankPayment: AgreementPaymentDetails = {
  method: "bank_account",
  bank: "",
  clearingNumber: "",
  accountNumber: "",
  bankgiro: "",
  plusgiro: "",
  other: "",
};
const blankHandover: AgreementHandoverSnapshot = {
  date: "",
  location: "",
  mileageKm: null,
  keyCount: null,
  summerWheelsIncluded: false,
  winterWheelsIncluded: false,
  notes: "",
};
const blankFinance: AgreementFinanceAllocation = {
  recipient: "",
  amountOre: 0,
  reference: "",
  agreementNumber: "",
  validUntil: "",
  bankgiro: "",
  plusgiro: "",
  iban: "",
  bic: "",
  otherPaymentInformation: "",
  comment: "",
};

function stockholmDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(new Date());
}

function parseKronor(value: string) {
  const normalized = value.trim().replace(/[\s.]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  const ore = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(ore) ? ore : null;
}

function oreToInput(value: number) {
  return value % 100 === 0
    ? String(value / 100)
    : `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

function money(value: number | null) {
  if (value === null) return "–";
  return `${new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: value % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value / 100)} kr`;
}

export function AgreementForm({
  company,
  deals,
  initialAgreement,
}: {
  company: CompanyProfile;
  deals: AgreementDealOption[];
  initialAgreement?: AgreementView;
}) {
  const router = useRouter();
  const [draftId, setDraftId] = useState(initialAgreement?.id ?? null);
  const [version, setVersion] = useState(initialAgreement?.version ?? null);
  const [dealId, setDealId] = useState(initialAgreement?.dealId ?? null);
  const [direction, setDirection] = useState(initialAgreement?.direction ?? "company_buys");
  const [agreementDate, setAgreementDate] = useState(initialAgreement?.agreementDate ?? stockholmDate());
  const [counterparty, setCounterparty] = useState<AgreementCounterpartySnapshot>(
    initialAgreement?.counterpartySnapshot ?? blankCounterparty,
  );
  const [vehicle, setVehicle] = useState<AgreementVehicleSnapshot>(
    initialAgreement?.vehicleSnapshot ?? blankVehicle,
  );
  const [vatMode, setVatMode] = useState(initialAgreement?.vatMode ?? "deductible");
  const [totalInput, setTotalInput] = useState(
    initialAgreement ? oreToInput(initialAgreement.totalAmountOre) : "",
  );
  const [financeEnabled, setFinanceEnabled] = useState(
    Boolean(initialAgreement?.financeAllocations.length),
  );
  const [finance, setFinance] = useState<AgreementFinanceAllocation>(
    initialAgreement?.financeAllocations[0] ?? blankFinance,
  );
  const [financeAmountInput, setFinanceAmountInput] = useState(
    initialAgreement?.financeAllocations[0]
      ? oreToInput(initialAgreement.financeAllocations[0].amountOre)
      : "",
  );
  const [payment, setPayment] = useState<AgreementPaymentDetails>(
    initialAgreement?.paymentDetails ?? blankPayment,
  );
  const [handover, setHandover] = useState<AgreementHandoverSnapshot>(
    initialAgreement?.handoverSnapshot ?? blankHandover,
  );
  const [additionalTerms, setAdditionalTerms] = useState(
    initialAgreement?.additionalTerms ?? "",
  );
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState<"save" | "generate" | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const totalOre = parseKronor(totalInput);
  const financeOre = financeEnabled ? parseKronor(financeAmountInput) : 0;
  const amounts = useMemo(() => {
    if (!totalOre || totalOre <= 0) return null;
    try {
      return calculateAgreementAmounts(totalOre, vatMode);
    } catch {
      return null;
    }
  }, [totalOre, vatMode]);
  const summary = useMemo(() => {
    if (!totalOre || financeOre === null) return null;
    try {
      return calculatePaymentSummary(
        totalOre,
        financeEnabled ? [{ recipient: finance.recipient, amountOre: financeOre }] : [],
      );
    } catch {
      return null;
    }
  }, [totalOre, financeOre, financeEnabled, finance.recipient]);

  function chooseDeal(value: string) {
    const deal = deals.find((item) => item.id === value);
    setDealId(deal?.id ?? null);
    if (!deal) return;
    setDirection(deal.viewerIsSeller ? "company_sells" : "company_buys");
    setCounterparty({
      ...blankCounterparty,
      kind: "company",
      companyName: deal.counterparty.name,
      contactPerson: deal.counterparty.contactName,
      email: deal.counterparty.email,
      phone: deal.counterparty.phone ?? "",
    });
    setVehicle({
      ...blankVehicle,
      registrationNumber: deal.registrationNumber ?? "",
      makeModel: deal.listingLabel,
      modelYear: deal.modelYear,
      mileageKm: Math.round(deal.mileageMil * 10),
    });
    setVatMode(deal.deductibleVat ? "deductible" : "margin_scheme");
    setTotalInput(oreToInput(deal.amountOre));
  }

  function validationError() {
    if (!agreementDate) return "Avtalsdatum måste anges.";
    if (counterparty.kind === "private_person" && (!counterparty.firstName || !counterparty.lastName))
      return "Motpartens för- och efternamn måste anges.";
    if (counterparty.kind === "company" && !counterparty.companyName)
      return "Motpartens företagsnamn måste anges.";
    if (!vehicle.registrationNumber.trim()) return "Registreringsnummer måste anges.";
    if (!vehicle.makeModel.trim()) return "Märke/modell måste anges.";
    if (!totalOre || totalOre <= 0) return "Köpeskillingen måste vara ett giltigt positivt belopp.";
    if (financeEnabled && (!finance.recipient.trim() || !financeOre || financeOre <= 0))
      return "Finansbolag och lösenbelopp måste anges när lösen är aktiverat.";
    if (financeEnabled && financeOre !== null && financeOre > totalOre)
      return "Lösenbeloppet får inte överstiga köpeskillingen.";
    return null;
  }

  function payload() {
    const parsedTotal = parseKronor(totalInput);
    const parsedFinance = parseKronor(financeAmountInput);
    if (!parsedTotal) throw new Error("INVALID_AMOUNT");
    return {
      dealId,
      direction,
      agreementDate,
      counterparty,
      vehicle,
      vatMode,
      totalAmountOre: parsedTotal,
      financeAllocations: financeEnabled
        ? [{ ...finance, amountOre: parsedFinance ?? 0 }]
        : [],
      paymentDetails: payment,
      handover,
      additionalTerms,
    };
  }

  async function saveDraft() {
    const invalid = validationError();
    if (invalid) throw new Error(invalid);
    const response = await fetch(draftId ? `/api/agreements/${draftId}` : "/api/agreements", {
      method: draftId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draftId ? { ...payload(), version } : payload()),
    });
    const body = (await response.json().catch(() => null)) as
      | { agreement?: AgreementView; error?: string }
      | null;
    if (!response.ok || !body?.agreement) {
      if (body?.error === "AGREEMENT_VERSION_CONFLICT")
        throw new Error("Utkastet har ändrats i en annan flik. Ladda om sidan.");
      throw new Error("Avtalsutkastet kunde inte sparas.");
    }
    setDraftId(body.agreement.id);
    setVersion(body.agreement.version);
    return body.agreement;
  }

  async function onSave() {
    setPending("save");
    setMessage(null);
    try {
      const saved = await saveDraft();
      setMessage({ type: "success", text: "Utkastet är sparat." });
      if (!draftId) router.replace(`/app/avtal/${saved.id}/redigera`);
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Avtalet kunde inte sparas." });
    } finally {
      setPending(null);
    }
  }

  function onPreview() {
    const invalid = validationError();
    if (invalid) {
      setMessage({ type: "error", text: invalid });
      return;
    }
    setMessage(null);
    setPreview(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onGenerate() {
    setPending("generate");
    setMessage(null);
    try {
      const saved = await saveDraft();
      const response = await fetch(`/api/agreements/${saved.id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: saved.version }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        if (body?.error === "COMPANY_PROFILE_INCOMPLETE")
          throw new Error("Företagsprofilen saknar adress, postnummer, ort eller telefonnummer. Komplettera under Inställningar.");
        throw new Error("PDF-filen kunde inte skapas.");
      }
      router.push(`/app/avtal/${saved.id}`);
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "PDF-filen kunde inte skapas." });
    } finally {
      setPending(null);
    }
  }

  if (preview) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setPreview(false)} className={secondaryButtonClassName}>
            <ArrowLeft className="mr-2" size={17} /> Tillbaka och redigera
          </button>
          <button type="button" onClick={onGenerate} disabled={pending !== null} className={primaryButtonClassName}>
            {pending === "generate" ? <LoaderCircle className="mr-2 animate-spin" size={17} /> : <FileDown className="mr-2" size={17} />}
            Skapa PDF
          </button>
        </div>
        {message ? <div className="mb-5"><FormMessage type={message.type}>{message.text}</FormMessage></div> : null}
        <AgreementPreview
          company={company}
          direction={direction}
          agreementDate={agreementDate}
          counterparty={counterparty}
          vehicle={vehicle}
          vatMode={vatMode}
          amounts={amounts}
          finance={financeEnabled && financeOre ? { ...finance, amountOre: financeOre } : null}
          payment={payment}
          handover={handover}
          additionalTerms={additionalTerms}
        />
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      {message ? <FormMessage type={message.type}>{message.text}</FormMessage> : null}
      <Section title="Grunduppgifter" description="Välj riktning och avtalsdatum.">
        {deals.length ? (
          <Field label="Hämta från Trejder-affär" as="select" value={dealId ?? ""} onChange={(value) => chooseDeal(value)}>
            <option value="">Fyll i manuellt</option>
            {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.listingLabel} · {money(deal.amountOre)}</option>)}
          </Field>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice active={direction === "company_buys"} onClick={() => setDirection("company_buys")} title="Vi köper fordonet" />
          <Choice active={direction === "company_sells"} onClick={() => setDirection("company_sells")} title="Vi säljer fordonet" />
        </div>
        <Field label="Avtalsdatum" type="date" value={agreementDate} onChange={setAgreementDate} required />
      </Section>

      <Section title="Aktivt företag" description="Dessa uppgifter hämtas från företagsprofilen och låses som en snapshot när utkastet sparas.">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Företag" value={company.legalName} />
          <Info label="Organisationsnummer" value={company.organizationNumber} />
          <Info label="Adress" value={[company.addressLine1, company.postalCode, company.city].filter(Boolean).join(", ")} missing />
          <Info label="Telefon" value={company.contactPhone ?? ""} missing />
          <Info label="E-post" value={company.contactEmail} />
          <Info label="Logotyp" value={company.hasLogo ? "Uppladdad" : "Textheader används"} />
        </div>
        {![company.addressLine1, company.postalCode, company.city, company.contactPhone].every(Boolean) ? (
          <p className="rounded-lg bg-[var(--warning-surface)] px-3 py-2 text-sm text-[var(--warning)]">
            Företagsprofilen måste kompletteras före PDF-generering. <Link className="font-semibold underline" href="/app/installningar">Öppna Inställningar</Link>
          </p>
        ) : null}
      </Section>

      <Section title="Motpart" description="Ange köparen eller säljaren som står på andra sidan av avtalet.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice active={counterparty.kind === "private_person"} onClick={() => setCounterparty({ ...counterparty, kind: "private_person" })} title="Privatperson" />
          <Choice active={counterparty.kind === "company"} onClick={() => setCounterparty({ ...counterparty, kind: "company" })} title="Företag" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {counterparty.kind === "private_person" ? <>
            <Field label="Förnamn" value={counterparty.firstName} onChange={(value) => setCounterparty({ ...counterparty, firstName: value })} required />
            <Field label="Efternamn" value={counterparty.lastName} onChange={(value) => setCounterparty({ ...counterparty, lastName: value })} required />
            <Field label="Personnummer (frivilligt)" value={counterparty.personalIdentityNumber} onChange={(value) => setCounterparty({ ...counterparty, personalIdentityNumber: value })} />
          </> : <>
            <Field label="Företagsnamn" value={counterparty.companyName} onChange={(value) => setCounterparty({ ...counterparty, companyName: value })} required />
            <Field label="Organisationsnummer" value={counterparty.organizationNumber} onChange={(value) => setCounterparty({ ...counterparty, organizationNumber: value })} />
            <Field label="Kontaktperson" value={counterparty.contactPerson} onChange={(value) => setCounterparty({ ...counterparty, contactPerson: value })} />
          </>}
          <Field label="Adress" value={counterparty.addressLine1} onChange={(value) => setCounterparty({ ...counterparty, addressLine1: value })} />
          <Field label="Postnummer" value={counterparty.postalCode} onChange={(value) => setCounterparty({ ...counterparty, postalCode: value })} />
          <Field label="Ort" value={counterparty.city} onChange={(value) => setCounterparty({ ...counterparty, city: value })} />
          <Field label="Telefonnummer" type="tel" value={counterparty.phone} onChange={(value) => setCounterparty({ ...counterparty, phone: value })} />
          <Field label="E-post" type="email" value={counterparty.email} onChange={(value) => setCounterparty({ ...counterparty, email: value })} />
        </div>
      </Section>

      <Section title="Fordon" description="Registreringsnummer och märke/modell är obligatoriska.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registreringsnummer" value={vehicle.registrationNumber} onChange={(value) => setVehicle({ ...vehicle, registrationNumber: value.toUpperCase() })} required />
          <Field label="Märke/modell" value={vehicle.makeModel} onChange={(value) => setVehicle({ ...vehicle, makeModel: value })} required />
          <Field label="Årsmodell" type="number" value={vehicle.modelYear?.toString() ?? ""} onChange={(value) => setVehicle({ ...vehicle, modelYear: value ? Number(value) : null })} />
          <Field label="Miltal" type="number" value={vehicle.mileageKm === null ? "" : String(vehicle.mileageKm / 10)} onChange={(value) => setVehicle({ ...vehicle, mileageKm: value ? Math.round(Number(value) * 10) : null })} />
          <Field label="Chassinummer/VIN" value={vehicle.vin} onChange={(value) => setVehicle({ ...vehicle, vin: value.toUpperCase() })} />
          <Field label="Färg" value={vehicle.color} onChange={(value) => setVehicle({ ...vehicle, color: value })} />
          <Field label="Första registreringsdatum" type="date" value={vehicle.firstRegistrationDate} onChange={(value) => setVehicle({ ...vehicle, firstRegistrationDate: value })} />
        </div>
      </Section>

      <Section title="Köpeskilling" description="SEK. Belopp hanteras som heltalsören på servern.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice active={vatMode === "deductible"} onClick={() => setVatMode("deductible")} title="Momsbil / avdragbar moms" />
          <Choice active={vatMode === "margin_scheme"} onClick={() => setVatMode("margin_scheme")} title="VMB / ej separat avdragbar moms" />
        </div>
        <Field label={vatMode === "deductible" ? "Köpeskilling inkl. moms (kr)" : "Köpeskilling (kr)"} inputMode="decimal" value={totalInput} onChange={setTotalInput} required />
        {amounts ? <div className="grid gap-3 rounded-xl bg-[var(--surface-subtle)] p-4 sm:grid-cols-3">
          {vatMode === "deductible" ? <><Info label="Exkl. moms" value={money(amounts.netOre)} /><Info label="Moms 25 %" value={money(amounts.vatOre)} /></> : <Info label="Moms" value="Ej specificerad separat" />}
          <Info label="Totalt" value={money(amounts.totalOre)} />
        </div> : null}
      </Section>

      <Section title="Lösen" description="Första versionen stöder en finans-/leasingmottagare; modellen kan utökas med fler.">
        <label className="flex items-center gap-3 font-medium"><input type="checkbox" checked={financeEnabled} onChange={(event) => setFinanceEnabled(event.target.checked)} /> Del av köpeskillingen ska lösas till finansbolag/leasinggivare</label>
        {financeEnabled ? <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Finansbolag / leasinggivare" value={finance.recipient} onChange={(value) => setFinance({ ...finance, recipient: value })} required />
          <Field label="Lösenbelopp (kr)" inputMode="decimal" value={financeAmountInput} onChange={setFinanceAmountInput} required />
          <Field label="Referens/OCR" value={finance.reference} onChange={(value) => setFinance({ ...finance, reference: value })} />
          <Field label="Avtalsnummer" value={finance.agreementNumber} onChange={(value) => setFinance({ ...finance, agreementNumber: value })} />
          <Field label="Giltigt till" type="date" value={finance.validUntil} onChange={(value) => setFinance({ ...finance, validUntil: value })} />
          <Field label="Bankgiro" value={finance.bankgiro} onChange={(value) => setFinance({ ...finance, bankgiro: value })} />
          <Field label="Plusgiro" value={finance.plusgiro} onChange={(value) => setFinance({ ...finance, plusgiro: value })} />
          <Field label="IBAN" value={finance.iban} onChange={(value) => setFinance({ ...finance, iban: value })} />
          <Field label="BIC/SWIFT" value={finance.bic} onChange={(value) => setFinance({ ...finance, bic: value })} />
          <Field label="Annan betalningsinformation" value={finance.otherPaymentInformation} onChange={(value) => setFinance({ ...finance, otherPaymentInformation: value })} />
          <Field label="Kommentar" value={finance.comment} onChange={(value) => setFinance({ ...finance, comment: value })} />
        </div> : null}
        {financeEnabled && financeOre !== null && totalOre && financeOre > totalOre ? <FormMessage type="error">Lösenbeloppet får inte överstiga köpeskillingen.</FormMessage> : null}
        {summary ? <div className="grid gap-3 rounded-xl bg-[var(--surface-subtle)] p-4 sm:grid-cols-3"><Info label="Till finansbolag" value={money(summary.allocatedOre)} /><Info label="Till säljaren" value={money(summary.remainingOre)} /><Info label="Totalt" value={money(summary.totalOre)} /></div> : null}
      </Section>

      <Section title="Utbetalning" description="Uppgifterna visas i avtalet men skrivs aldrig till applikationsloggen.">
        <Field label="Betalningssätt" as="select" value={payment.method} onChange={(value) => setPayment({ ...payment, method: value as AgreementPaymentDetails["method"] })}>
          <option value="bank_account">Bankkonto</option><option value="bankgiro">Bankgiro</option><option value="plusgiro">Plusgiro</option><option value="other">Annat</option>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {payment.method === "bank_account" ? <><Field label="Bank" value={payment.bank} onChange={(value) => setPayment({ ...payment, bank: value })} /><Field label="Clearingnummer" value={payment.clearingNumber} onChange={(value) => setPayment({ ...payment, clearingNumber: value })} /><Field label="Kontonummer" value={payment.accountNumber} onChange={(value) => setPayment({ ...payment, accountNumber: value })} /></> : null}
          {payment.method === "bankgiro" ? <Field label="Bankgiro" value={payment.bankgiro} onChange={(value) => setPayment({ ...payment, bankgiro: value })} /> : null}
          {payment.method === "plusgiro" ? <Field label="Plusgiro" value={payment.plusgiro} onChange={(value) => setPayment({ ...payment, plusgiro: value })} /> : null}
          {payment.method === "other" ? <Field label="Betalningsinformation" value={payment.other} onChange={(value) => setPayment({ ...payment, other: value })} /> : null}
        </div>
      </Section>

      <Section title="Överlämning" description="Frivilliga uppgifter om överlämningen.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Datum" type="date" value={handover.date} onChange={(value) => setHandover({ ...handover, date: value })} />
          <Field label="Ort" value={handover.location} onChange={(value) => setHandover({ ...handover, location: value })} />
          <Field label="Miltal vid överlämning" type="number" value={handover.mileageKm === null ? "" : String(handover.mileageKm / 10)} onChange={(value) => setHandover({ ...handover, mileageKm: value ? Math.round(Number(value) * 10) : null })} />
          <Field label="Antal nycklar" type="number" value={handover.keyCount?.toString() ?? ""} onChange={(value) => setHandover({ ...handover, keyCount: value ? Number(value) : null })} />
        </div>
        <div className="flex flex-wrap gap-5"><Check label="Sommarhjul ingår" checked={handover.summerWheelsIncluded} onChange={(checked) => setHandover({ ...handover, summerWheelsIncluded: checked })} /><Check label="Vinterhjul ingår" checked={handover.winterWheelsIncluded} onChange={(checked) => setHandover({ ...handover, winterWheelsIncluded: checked })} /></div>
        <TextArea label="Övrigt" value={handover.notes} onChange={(value) => setHandover({ ...handover, notes: value })} maxLength={1000} />
      </Section>

      <Section title="Övriga villkor / information" description="Exempelvis kända skador, utrustning och överenskommelser. Standardtexten är en juridisk placeholder tills den har granskats.">
        <TextArea label="Villkor och information" value={additionalTerms} onChange={setAdditionalTerms} maxLength={5000} placeholder={DEFAULT_AGREEMENT_TERMS_SV} />
      </Section>

      <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-lg backdrop-blur">
        <button type="button" onClick={onSave} disabled={pending !== null} className={secondaryButtonClassName}>{pending === "save" ? <LoaderCircle className="mr-2 animate-spin" size={17} /> : <Save className="mr-2" size={17} />} Spara utkast</button>
        <button type="button" onClick={onPreview} disabled={pending !== null} className={primaryButtonClassName}><Eye className="mr-2" size={17} /> Förhandsgranska</button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div><h2 className="text-xl font-semibold">{title}</h2>{description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}</div>{children}</section>;
}

function Field({ label, as, value, onChange, children, ...props }: { label: string; as?: "select"; value: string; onChange: (value: string) => void; children?: ReactNode } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <label className="block font-medium">{label}{as === "select" ? <select className={inputClassName} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select> : <input {...props} className={inputClassName} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function TextArea({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  return <label className="block font-medium">{label}<textarea {...props} className={`${inputClassName} min-h-28`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Choice({ active, onClick, title }: { active: boolean; onClick: () => void; title: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-12 rounded-xl border px-4 text-left font-semibold ${active ? "border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>{title}</button>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>;
}

function Info({ label, value, missing = false }: { label: string; value: string; missing?: boolean }) {
  return <div><dt className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</dt><dd className={`mt-1 font-medium ${missing && !value ? "text-[var(--danger)]" : ""}`}>{value || "Saknas"}</dd></div>;
}

function AgreementPreview({ company, direction, agreementDate, counterparty, vehicle, vatMode, amounts, finance, payment, handover, additionalTerms }: {
  company: CompanyProfile; direction: "company_buys" | "company_sells"; agreementDate: string; counterparty: AgreementCounterpartySnapshot; vehicle: AgreementVehicleSnapshot; vatMode: "deductible" | "margin_scheme"; amounts: ReturnType<typeof calculateAgreementAmounts> | null; finance: AgreementFinanceAllocation | null; payment: AgreementPaymentDetails; handover: AgreementHandoverSnapshot; additionalTerms: string;
}) {
  const positions = agreementParties(direction);
  const counterpartyName = counterparty.kind === "company" ? counterparty.companyName : `${counterparty.firstName} ${counterparty.lastName}`.trim();
  const remaining = amounts ? amounts.totalOre - (finance?.amountOre ?? 0) : null;
  return <article className="mx-auto min-h-[70rem] max-w-[52rem] bg-white p-8 text-slate-950 shadow-xl sm:p-12 print:shadow-none">
    <header className="border-b-2 border-emerald-800 pb-6"><div className="flex items-start justify-between gap-4"><div>{company.hasLogo ? <Image src="/api/company/profile/logo" alt={`${company.legalName} logotyp`} width={192} height={64} unoptimized className="mb-4 max-h-16 max-w-48 object-contain object-left" /> : <p className="text-xl font-bold">{company.legalName}</p>}<h2 className="mt-3 text-3xl font-bold">KÖPEAVTAL – FORDON</h2></div><p className="text-sm text-slate-600">Förhandsgranskning<br />{agreementDate}</p></div></header>
    <PreviewSection title={positions.companyParty === "buyer" ? "Köpare" : "Säljare"}><PreviewRow label="Företag" value={company.legalName} /><PreviewRow label="Organisationsnummer" value={company.organizationNumber} /><PreviewRow label="Adress" value={[company.addressLine1, company.postalCode, company.city].filter(Boolean).join(", ")} /><PreviewRow label="Kontakt" value={[company.contactPhone, company.contactEmail].filter(Boolean).join(" · ")} /></PreviewSection>
    <PreviewSection title={positions.counterparty === "buyer" ? "Köpare" : "Säljare"}><PreviewRow label={counterparty.kind === "company" ? "Företag" : "Namn"} value={counterpartyName} /><PreviewRow label="Identitet" value={counterparty.kind === "company" ? counterparty.organizationNumber : counterparty.personalIdentityNumber} /><PreviewRow label="Adress" value={[counterparty.addressLine1, counterparty.postalCode, counterparty.city].filter(Boolean).join(", ")} /><PreviewRow label="Kontakt" value={[counterparty.phone, counterparty.email].filter(Boolean).join(" · ")} /></PreviewSection>
    <PreviewSection title="Fordon"><PreviewRow label="Registreringsnummer" value={vehicle.registrationNumber.toUpperCase()} /><PreviewRow label="Märke/modell" value={vehicle.makeModel} /><PreviewRow label="Årsmodell" value={vehicle.modelYear?.toString() ?? ""} /><PreviewRow label="Miltal" value={vehicle.mileageKm === null ? "" : `${new Intl.NumberFormat("sv-SE").format(vehicle.mileageKm / 10)} mil`} /><PreviewRow label="VIN" value={vehicle.vin} /></PreviewSection>
    <PreviewSection title="Köpeskilling">{vatMode === "deductible" ? <><PreviewRow label="Exkl. moms" value={money(amounts?.netOre ?? null)} /><PreviewRow label="Moms 25 %" value={money(amounts?.vatOre ?? null)} /></> : <PreviewRow label="Moms" value="Ej specificerad som separat avdragsgill moms" />}<PreviewRow label="Totalt" value={money(amounts?.totalOre ?? null)} /></PreviewSection>
    {finance ? <PreviewSection title="Betalningsfördelning"><PreviewRow label={`Till ${finance.recipient}`} value={money(finance.amountOre)} /><PreviewRow label="Till säljaren" value={money(remaining)} /><PreviewRow label="Totalt" value={money(amounts?.totalOre ?? null)} /></PreviewSection> : null}
    <PreviewSection title="Utbetalning"><PreviewRow label="Betalningssätt" value={payment.method} /><PreviewRow label="Betalningsuppgift" value={payment.accountNumber || payment.bankgiro || payment.plusgiro || payment.other} /></PreviewSection>
    {(handover.date || handover.location || handover.notes) ? <PreviewSection title="Överlämning"><PreviewRow label="Datum och ort" value={[handover.date, handover.location].filter(Boolean).join(" · ")} /><PreviewRow label="Övrigt" value={handover.notes} /></PreviewSection> : null}
    <PreviewSection title="Övriga villkor / information"><p className="whitespace-pre-wrap text-sm leading-6">{additionalTerms || DEFAULT_AGREEMENT_TERMS_SV}</p></PreviewSection>
    <div className="mt-14 grid grid-cols-2 gap-10"><Signature title="Köpare" /><Signature title="Säljare" /></div>
  </article>;
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) { return <section className="border-b border-slate-200 py-6"><h3 className="mb-4 text-sm font-bold tracking-wider text-emerald-800 uppercase">{title}</h3><div className="space-y-2">{children}</div></section>; }
function PreviewRow({ label, value }: { label: string; value: string }) { return value ? <div className="grid grid-cols-[9rem_1fr] gap-3 text-sm"><span className="font-semibold text-slate-600">{label}</span><span>{value}</span></div> : null; }
function Signature({ title }: { title: string }) { return <div><p className="font-semibold">{title}</p><div className="mt-12 border-b border-slate-700" /><p className="mt-1 text-xs text-slate-500">Underskrift / namnförtydligande</p><div className="mt-8 border-b border-slate-700" /><p className="mt-1 text-xs text-slate-500">Ort och datum</p></div>; }
