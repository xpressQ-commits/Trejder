// @vitest-environment node

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generateAgreementPdf, type AgreementPdfData } from "./pdf";

const fixture: AgreementPdfData = {
  agreementNumber: "TA-2026-000123",
  agreementDate: "2026-10-16",
  direction: "company_buys",
  company: {
    legalName: "PWT Invest AB",
    organizationNumber: "559429-3390",
    addressLine1: "Testgatan 1",
    postalCode: "111 22",
    city: "Stockholm",
    phone: "070-000 00 00",
    email: "admin@trejder.se",
    vatNumber: "SE559429339001",
    logoObjectKey: null,
    logoMimeType: null,
  },
  counterparty: {
    kind: "company",
    firstName: "",
    lastName: "",
    personalIdentityNumber: "",
    companyName: "Motpart Bil AB",
    organizationNumber: "556000-0000",
    addressLine1: "Bilvägen 2",
    postalCode: "222 33",
    city: "Göteborg",
    contactPerson: "Anna Andersson",
    phone: "031-000 00 00",
    email: "anna@example.test",
  },
  vehicle: {
    registrationNumber: "ABC123",
    makeModel: "BMW 530e",
    modelYear: 2022,
    mileageKm: 64_500,
    vin: "WBA00000000000000",
    color: "Svart",
    firstRegistrationDate: "2022-02-01",
  },
  vatMode: "deductible",
  totalAmountOre: 50_000_000,
  netAmountOre: 40_000_000,
  vatAmountOre: 10_000_000,
  financeAllocations: [{
    recipient: "Trejder Finans AB",
    amountOre: 32_000_000,
    reference: "12345",
    agreementNumber: "FIN-1",
    validUntil: "2026-10-31",
    bankgiro: "123-4567",
    plusgiro: "",
    iban: "",
    bic: "",
    otherPaymentInformation: "",
    comment: "",
  }],
  paymentDetails: {
    method: "bank_account",
    bank: "Testbanken",
    clearingNumber: "1234",
    accountNumber: "0000000",
    bankgiro: "",
    plusgiro: "",
    other: "",
  },
  handover: {
    date: "2026-10-17",
    location: "Stockholm",
    mileageKm: 64_500,
    keyCount: 2,
    summerWheelsIncluded: true,
    winterWheelsIncluded: true,
    notes: "Båda nycklarna överlämnas.",
  },
  additionalTerms: "Testvillkor utan juridiska standardpåståenden.",
};

describe("agreement PDF", () => {
  it("creates a real A4 PDF with Trejder metadata", async () => {
    const bytes = await generateAgreementPdf(fixture);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toBe("Köpeavtal TA-2026-000123");
    expect(document.getAuthor()).toBe("PWT Invest AB");
    expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
    const [width, height] = document.getPage(0).getSize().width > 0
      ? [document.getPage(0).getWidth(), document.getPage(0).getHeight()]
      : [0, 0];
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
  });

  it("supports both buyer/seller directions and margin-scheme output", async () => {
    const bytes = await generateAgreementPdf({
      ...fixture,
      direction: "company_sells",
      vatMode: "margin_scheme",
      netAmountOre: null,
      vatAmountOre: null,
      financeAllocations: [],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });
});
