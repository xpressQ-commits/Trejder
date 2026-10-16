import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  AgreementCompanySnapshot,
  AgreementCounterpartySnapshot,
  AgreementDirection,
  AgreementFinanceAllocation,
  AgreementHandoverSnapshot,
  AgreementPaymentDetails,
  AgreementVehicleSnapshot,
  AgreementVatMode,
} from "@/domain/agreement";
import { agreementParties, calculatePaymentSummary } from "@/domain/agreement";
import { DEFAULT_AGREEMENT_TERMS_SV } from "@/domain/agreement-terms";
import { formatRegistrationNumber } from "@/domain/registration-number";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;
const TEXT = rgb(0.08, 0.1, 0.13);
const MUTED = rgb(0.36, 0.4, 0.46);
const PRIMARY = rgb(0.03, 0.36, 0.29);
const RULE = rgb(0.82, 0.84, 0.87);

export type AgreementPdfData = {
  agreementNumber: string;
  agreementDate: string;
  direction: AgreementDirection;
  company: AgreementCompanySnapshot;
  counterparty: AgreementCounterpartySnapshot;
  vehicle: AgreementVehicleSnapshot;
  vatMode: AgreementVatMode;
  totalAmountOre: number;
  netAmountOre: number | null;
  vatAmountOre: number | null;
  financeAllocations: AgreementFinanceAllocation[];
  paymentDetails: AgreementPaymentDetails;
  handover: AgreementHandoverSnapshot;
  additionalTerms: string;
};

function safeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^ -~ -ÿŒœŠšŸŽž€]/g, "?");
}

function money(amountOre: number) {
  return `${new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: amountOre % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(amountOre / 100)
    .replace(/[\u00a0\u202f]/g, " ")} kr`;
}

function dateSv(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long",
    timeZone: "Europe/Stockholm",
  }).format(new Date(`${value}T12:00:00+02:00`));
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else if (line) {
      lines.push(line);
      line = word;
    } else {
      lines.push(word.slice(0, 80));
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function generateAgreementPdf(
  data: AgreementPdfData,
  logo?: { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" },
) {
  const document = await PDFDocument.create();
  document.setTitle(`Köpeavtal ${data.agreementNumber}`);
  document.setAuthor(data.company.legalName);
  document.setSubject("Köpeavtal fordon");
  document.setProducer("Trejder");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let embeddedLogo: PDFImage | undefined;
  if (logo) {
    embeddedLogo =
      logo.mimeType === "image/png"
        ? await document.embedPng(logo.bytes)
        : await document.embedJpg(logo.bytes);
  }

  let page: PDFPage = document.addPage(A4);
  let y = A4[1] - MARGIN;
  const addPage = () => {
    page = document.addPage(A4);
    y = A4[1] - MARGIN;
    page.drawText("TREJDER AVTAL", {
      x: MARGIN,
      y,
      size: 8,
      font: bold,
      color: MUTED,
    });
    page.drawText(data.agreementNumber, {
      x: A4[0] - MARGIN - bold.widthOfTextAtSize(data.agreementNumber, 8),
      y,
      size: 8,
      font: bold,
      color: MUTED,
    });
    y -= 22;
  };
  page.drawText("TREJDER AVTAL", {
    x: MARGIN,
    y,
    size: 8,
    font: bold,
    color: MUTED,
  });
  page.drawText(data.agreementNumber, {
    x: A4[0] - MARGIN - bold.widthOfTextAtSize(data.agreementNumber, 8),
    y,
    size: 8,
    font: bold,
    color: MUTED,
  });
  y -= 22;

  const ensure = (height: number) => {
    if (y - height < MARGIN + 24) addPage();
  };
  const rule = () => {
    ensure(14);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4[0] - MARGIN, y },
      thickness: 0.7,
      color: RULE,
    });
    y -= 14;
  };
  const heading = (value: string) => {
    ensure(34);
    page.drawText(safeText(value.toUpperCase()), {
      x: MARGIN,
      y,
      size: 11,
      font: bold,
      color: PRIMARY,
    });
    y -= 20;
  };
  const pair = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    const rendered = safeText(String(value));
    const lines = wrap(regular, rendered, 10, CONTENT_WIDTH - 145);
    ensure(Math.max(18, lines.length * 13));
    page.drawText(safeText(label), {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: MUTED,
    });
    lines.forEach((line, index) =>
      page.drawText(line, {
        x: MARGIN + 145,
        y: y - index * 13,
        size: 10,
        font: regular,
        color: TEXT,
      }),
    );
    y -= Math.max(18, lines.length * 13 + 4);
  };
  const paragraph = (value: string) => {
    const lines = wrap(regular, value, 10, CONTENT_WIDTH);
    ensure(lines.length * 14 + 8);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: TEXT });
      y -= 14;
    }
    y -= 5;
  };

  if (embeddedLogo) {
    const scale = Math.min(150 / embeddedLogo.width, 64 / embeddedLogo.height, 1);
    page.drawImage(embeddedLogo, {
      x: MARGIN,
      y: y - embeddedLogo.height * scale,
      width: embeddedLogo.width * scale,
      height: embeddedLogo.height * scale,
    });
    y -= Math.max(72, embeddedLogo.height * scale + 8);
  } else {
    page.drawText(safeText(data.company.legalName), {
      x: MARGIN,
      y,
      size: 16,
      font: bold,
      color: TEXT,
    });
    y -= 26;
  }
  page.drawText("KÖPEAVTAL - FORDON", {
    x: MARGIN,
    y,
    size: 22,
    font: bold,
    color: TEXT,
  });
  y -= 30;
  pair("Avtalsnummer", data.agreementNumber);
  pair("Avtalsdatum", dateSv(data.agreementDate));
  rule();

  const positions = agreementParties(data.direction);
  const companyTitle = positions.companyParty === "buyer" ? "KÖPARE" : "SÄLJARE";
  const counterpartyTitle = positions.counterparty === "buyer" ? "KÖPARE" : "SÄLJARE";
  heading(companyTitle);
  pair("Företag", data.company.legalName);
  pair("Organisationsnummer", data.company.organizationNumber);
  pair("Adress", data.company.addressLine1);
  pair("Postnummer och ort", [data.company.postalCode, data.company.city].filter(Boolean).join(" "));
  pair("Telefon", data.company.phone);
  pair("E-post", data.company.email);
  pair("Momsregistreringsnr", data.company.vatNumber);
  rule();

  heading(counterpartyTitle);
  if (data.counterparty.kind === "private_person") {
    pair("Namn", `${data.counterparty.firstName} ${data.counterparty.lastName}`.trim());
    pair("Personnummer", data.counterparty.personalIdentityNumber);
  } else {
    pair("Företag", data.counterparty.companyName);
    pair("Organisationsnummer", data.counterparty.organizationNumber);
    pair("Kontaktperson", data.counterparty.contactPerson);
  }
  pair("Adress", data.counterparty.addressLine1);
  pair("Postnummer och ort", [data.counterparty.postalCode, data.counterparty.city].filter(Boolean).join(" "));
  pair("Telefon", data.counterparty.phone);
  pair("E-post", data.counterparty.email);
  rule();

  heading("FORDON");
  pair("Registreringsnummer", formatRegistrationNumber(data.vehicle.registrationNumber));
  pair("Märke/modell", data.vehicle.makeModel);
  pair("Årsmodell", data.vehicle.modelYear);
  pair("Miltal", data.vehicle.mileageKm === null ? null : `${new Intl.NumberFormat("sv-SE").format(data.vehicle.mileageKm / 10)} mil`);
  pair("Chassinummer/VIN", data.vehicle.vin);
  pair("Färg", data.vehicle.color);
  pair("Första registreringsdatum", data.vehicle.firstRegistrationDate);
  rule();

  heading("KÖPESKILLING");
  if (data.vatMode === "deductible") {
    pair("Pris exkl. moms", money(data.netAmountOre ?? 0));
    pair("Moms 25 %", money(data.vatAmountOre ?? 0));
    pair("Totalt inkl. moms", money(data.totalAmountOre));
  } else {
    pair("Köpeskilling", money(data.totalAmountOre));
    pair("Moms", "Ingen separat avdragsgill moms specificeras i avtalet");
  }

  const summary = calculatePaymentSummary(
    data.totalAmountOre,
    data.financeAllocations.map((allocation) => ({
      recipient: allocation.recipient,
      amountOre: allocation.amountOre,
    })),
  );
  if (data.financeAllocations.length) {
    rule();
    heading("BETALNINGSFÖRDELNING");
    for (const allocation of data.financeAllocations) {
      pair("Finansbolag/leasinggivare", allocation.recipient);
      pair("Lösenbelopp", money(allocation.amountOre));
      pair("Referens/OCR", allocation.reference);
      pair("Avtalsnummer", allocation.agreementNumber);
      pair("Giltigt till", allocation.validUntil);
      pair("Bankgiro", allocation.bankgiro);
      pair("Plusgiro", allocation.plusgiro);
      pair("IBAN", allocation.iban);
      pair("BIC/SWIFT", allocation.bic);
      pair("Annan betalningsinformation", allocation.otherPaymentInformation);
      pair("Kommentar", allocation.comment);
    }
    pair("Återstår till säljaren", money(summary.remainingOre));
    pair("Totalt", money(summary.totalOre));
  }

  rule();
  heading("UTBETALNING");
  const methodLabels: Record<AgreementPaymentDetails["method"], string> = {
    bank_account: "Bankkonto",
    bankgiro: "Bankgiro",
    plusgiro: "Plusgiro",
    other: "Annat",
  };
  pair("Betalningssätt", methodLabels[data.paymentDetails.method]);
  pair("Bank", data.paymentDetails.bank);
  pair("Clearingnummer", data.paymentDetails.clearingNumber);
  pair("Kontonummer", data.paymentDetails.accountNumber);
  pair("Bankgiro", data.paymentDetails.bankgiro);
  pair("Plusgiro", data.paymentDetails.plusgiro);
  pair("Betalningsinformation", data.paymentDetails.other);

  if (
    data.handover.date ||
    data.handover.location ||
    data.handover.mileageKm !== null ||
    data.handover.notes
  ) {
    rule();
    heading("ÖVERLÄMNING");
    pair("Datum", data.handover.date);
    pair("Ort", data.handover.location);
    pair("Miltal", data.handover.mileageKm === null ? null : `${new Intl.NumberFormat("sv-SE").format(data.handover.mileageKm / 10)} mil`);
    pair("Antal nycklar", data.handover.keyCount);
    pair("Sommarhjul", data.handover.summerWheelsIncluded ? "Ingår" : "Ej angivet som inkluderat");
    pair("Vinterhjul", data.handover.winterWheelsIncluded ? "Ingår" : "Ej angivet som inkluderat");
    pair("Övrigt", data.handover.notes);
  }

  rule();
  heading("ÖVRIGA VILLKOR / INFORMATION");
  paragraph(data.additionalTerms || DEFAULT_AGREEMENT_TERMS_SV);

  rule();
  heading("UNDERSKRIFTER");
  ensure(150);
  const half = (CONTENT_WIDTH - 28) / 2;
  const signature = (x: number, title: string) => {
    page.drawText(safeText(title), { x, y, size: 10, font: bold, color: TEXT });
    page.drawLine({ start: { x, y: y - 42 }, end: { x: x + half, y: y - 42 }, thickness: 0.7, color: TEXT });
    page.drawText("Underskrift", { x, y: y - 55, size: 8, font: regular, color: MUTED });
    page.drawLine({ start: { x, y: y - 88 }, end: { x: x + half, y: y - 88 }, thickness: 0.7, color: TEXT });
    page.drawText("Namnförtydligande", { x, y: y - 101, size: 8, font: regular, color: MUTED });
    page.drawLine({ start: { x, y: y - 134 }, end: { x: x + half, y: y - 134 }, thickness: 0.7, color: TEXT });
    page.drawText("Ort och datum", { x, y: y - 147, size: 8, font: regular, color: MUTED });
  };
  signature(MARGIN, "Köpare");
  signature(MARGIN + half + 28, "Säljare");

  const pageCount = document.getPageCount();
  document.getPages().forEach((item, index) => {
    const label = `Sida ${index + 1} av ${pageCount}`;
    item.drawText(label, {
      x: A4[0] - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: 24,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });
  return new Uint8Array(await document.save({ useObjectStreams: false }));
}
