import { describe, expect, it } from "vitest";
import { agreementInputSchema } from "./http";

const valid = {
  dealId: null,
  direction: "company_buys" as const,
  agreementDate: "2026-10-16",
  counterparty: {
    kind: "company" as const,
    firstName: "",
    lastName: "",
    personalIdentityNumber: "",
    companyName: "Motpart AB",
    organizationNumber: "556000-0000",
    addressLine1: "Gatan 1",
    postalCode: "111 22",
    city: "Stockholm",
    contactPerson: "Anna",
    phone: "0700000000",
    email: "anna@example.test",
  },
  vehicle: {
    registrationNumber: "ABC123",
    makeModel: "BMW 530e",
    modelYear: 2022,
    mileageKm: 64_500,
    vin: "",
    color: "Svart",
    firstRegistrationDate: "",
  },
  vatMode: "deductible" as const,
  totalAmountOre: 50_000_000,
  financeAllocations: [],
  paymentDetails: {
    method: "bank_account" as const,
    bank: "Testbanken",
    clearingNumber: "1234",
    accountNumber: "0000000",
    bankgiro: "",
    plusgiro: "",
    other: "",
  },
  handover: {
    date: "",
    location: "",
    mileageKm: null,
    keyCount: null,
    summerWheelsIncluded: false,
    winterWheelsIncluded: false,
    notes: "",
  },
  additionalTerms: "",
};

describe("agreement input contract", () => {
  it("accepts a complete draft and preserves payment data", () => {
    const result = agreementInputSchema.parse(valid);
    expect(result.vehicle.registrationNumber).toBe("ABC123");
    expect(result.paymentDetails.accountNumber).toBe("0000000");
  });

  it.each([
    ["registration number", { vehicle: { ...valid.vehicle, registrationNumber: "" } }],
    ["vehicle model", { vehicle: { ...valid.vehicle, makeModel: "" } }],
    ["amount", { totalAmountOre: 0 }],
    ["VAT mode", { vatMode: undefined }],
  ])("rejects a missing required %s", (_name, override) => {
    expect(agreementInputSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("supports one finance settlement and rejects a second recipient", () => {
    const allocation = {
      recipient: "Trejder Finans AB",
      amountOre: 32_000_000,
      reference: "123",
      agreementNumber: "",
      validUntil: "",
      bankgiro: "123-4567",
      plusgiro: "",
      iban: "",
      bic: "",
      otherPaymentInformation: "",
      comment: "",
    };
    expect(agreementInputSchema.safeParse({ ...valid, financeAllocations: [allocation] }).success).toBe(true);
    expect(agreementInputSchema.safeParse({ ...valid, financeAllocations: [allocation, allocation] }).success).toBe(false);
  });

  it("rejects forged server-owned fields", () => {
    expect(
      agreementInputSchema.safeParse({
        ...valid,
        companyId: "11111111-1111-4111-8111-111111111111",
        status: "generated",
        pdfObjectKey: "attacker-controlled",
      }).success,
    ).toBe(false);
  });
});
