export const agreementDirections = ["company_buys", "company_sells"] as const;
export type AgreementDirection = (typeof agreementDirections)[number];

export const agreementStatuses = [
  "draft",
  "generated",
  "completed",
  "cancelled",
] as const;
export type AgreementStatus = (typeof agreementStatuses)[number];

export const agreementVatModes = ["deductible", "margin_scheme"] as const;
export type AgreementVatMode = (typeof agreementVatModes)[number];

export const counterpartyKinds = ["private_person", "company"] as const;
export type CounterpartyKind = (typeof counterpartyKinds)[number];

export const paymentMethods = [
  "bank_account",
  "bankgiro",
  "plusgiro",
  "other",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export type AgreementAmounts = Readonly<{
  totalOre: number;
  netOre: number | null;
  vatOre: number | null;
}>;

export type PaymentAllocation = Readonly<{
  recipient: string;
  amountOre: number;
}>;

export type AgreementCompanySnapshot = Readonly<{
  legalName: string;
  organizationNumber: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  vatNumber: string;
  logoObjectKey: string | null;
  logoMimeType: "image/png" | "image/jpeg" | null;
}>;

export type AgreementCounterpartySnapshot = Readonly<{
  kind: CounterpartyKind;
  firstName: string;
  lastName: string;
  personalIdentityNumber: string;
  companyName: string;
  organizationNumber: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  contactPerson: string;
  phone: string;
  email: string;
}>;

export type AgreementVehicleSnapshot = Readonly<{
  registrationNumber: string;
  makeModel: string;
  modelYear: number | null;
  mileageKm: number | null;
  vin: string;
  color: string;
  firstRegistrationDate: string;
}>;

export type AgreementFinanceAllocation = Readonly<{
  recipient: string;
  amountOre: number;
  reference: string;
  agreementNumber: string;
  validUntil: string;
  bankgiro: string;
  plusgiro: string;
  iban: string;
  bic: string;
  otherPaymentInformation: string;
  comment: string;
}>;

export type AgreementPaymentDetails = Readonly<{
  method: PaymentMethod;
  bank: string;
  clearingNumber: string;
  accountNumber: string;
  bankgiro: string;
  plusgiro: string;
  other: string;
}>;

export type AgreementHandoverSnapshot = Readonly<{
  date: string;
  location: string;
  mileageKm: number | null;
  keyCount: number | null;
  summerWheelsIncluded: boolean;
  winterWheelsIncluded: boolean;
  notes: string;
}>;

function assertOre(value: number, name: string, allowZero = false) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    (!allowZero && value === 0)
  ) {
    throw new RangeError(`${name} must be a ${allowZero ? "non-negative" : "positive"} integer amount in öre`);
  }
}

/**
 * The total including VAT is the single source input. Integer arithmetic keeps
 * the accounting split deterministic and makes total = net + VAT invariant.
 */
export function calculateAgreementAmounts(
  totalOre: number,
  vatMode: AgreementVatMode,
): AgreementAmounts {
  assertOre(totalOre, "totalOre");
  if (vatMode === "margin_scheme") {
    return { totalOre, netOre: null, vatOre: null };
  }
  const roundedNet = Number((BigInt(totalOre) * 100n + 62n) / 125n);
  return {
    totalOre,
    netOre: roundedNet,
    vatOre: totalOre - roundedNet,
  };
}

export function calculatePaymentSummary(
  totalOre: number,
  allocations: readonly PaymentAllocation[],
) {
  assertOre(totalOre, "totalOre");
  let allocatedOre = 0;
  for (const allocation of allocations) {
    assertOre(allocation.amountOre, "allocation.amountOre", true);
    allocatedOre += allocation.amountOre;
    if (!Number.isSafeInteger(allocatedOre)) {
      throw new RangeError("allocated amount exceeds the safe integer range");
    }
  }
  if (allocatedOre > totalOre) {
    throw new RangeError("payment allocations cannot exceed the purchase price");
  }
  return {
    totalOre,
    allocatedOre,
    remainingOre: totalOre - allocatedOre,
  } as const;
}

export function agreementParties(direction: AgreementDirection) {
  return direction === "company_buys"
    ? { companyParty: "buyer", counterparty: "seller" }
    : { companyParty: "seller", counterparty: "buyer" };
}
