import { z } from "zod";
import {
  agreementDirections,
  agreementVatModes,
  counterpartyKinds,
  paymentMethods,
} from "@/domain/agreement";

const optionalText = (maximum: number) => z.string().trim().max(maximum);
const nullableInteger = z.number().int().nonnegative().nullable();

const counterpartySchema = z
  .object({
    kind: z.enum(counterpartyKinds),
    firstName: optionalText(100),
    lastName: optionalText(100),
    personalIdentityNumber: optionalText(20),
    companyName: optionalText(200),
    organizationNumber: optionalText(20),
    addressLine1: optionalText(240),
    postalCode: optionalText(12),
    city: optionalText(120),
    contactPerson: optionalText(200),
    phone: optionalText(40),
    email: optionalText(320),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.kind === "private_person" &&
      (!value.firstName || !value.lastName)
    ) {
      context.addIssue({
        code: "custom",
        message: "COUNTERPARTY_NAME_REQUIRED",
        path: ["firstName"],
      });
    }
    if (value.kind === "company" && !value.companyName) {
      context.addIssue({
        code: "custom",
        message: "COUNTERPARTY_COMPANY_REQUIRED",
        path: ["companyName"],
      });
    }
    if (value.email && !z.email().safeParse(value.email).success) {
      context.addIssue({
        code: "custom",
        message: "COUNTERPARTY_EMAIL_INVALID",
        path: ["email"],
      });
    }
  });

const financeAllocationSchema = z
  .object({
    recipient: z.string().trim().min(1).max(200),
    amountOre: z.number().int().positive().max(2_000_000_000),
    reference: optionalText(120),
    agreementNumber: optionalText(120),
    validUntil: optionalText(10),
    bankgiro: optionalText(30),
    plusgiro: optionalText(30),
    iban: optionalText(40),
    bic: optionalText(20),
    otherPaymentInformation: optionalText(500),
    comment: optionalText(500),
  })
  .strict();

export const agreementInputSchema = z
  .object({
    dealId: z.uuid().nullable(),
    direction: z.enum(agreementDirections),
    agreementDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/),
    counterparty: counterpartySchema,
    vehicle: z
      .object({
        registrationNumber: z.string().trim().min(1).max(16),
        makeModel: z.string().trim().min(1).max(160),
        modelYear: z.number().int().min(1950).max(3000).nullable(),
        mileageKm: nullableInteger,
        vin: optionalText(40),
        color: optionalText(80),
        firstRegistrationDate: optionalText(10),
      })
      .strict(),
    vatMode: z.enum(agreementVatModes),
    totalAmountOre: z.number().int().positive().max(2_000_000_000),
    financeAllocations: z.array(financeAllocationSchema).max(1),
    paymentDetails: z
      .object({
        method: z.enum(paymentMethods),
        bank: optionalText(120),
        clearingNumber: optionalText(20),
        accountNumber: optionalText(40),
        bankgiro: optionalText(30),
        plusgiro: optionalText(30),
        other: optionalText(500),
      })
      .strict(),
    handover: z
      .object({
        date: optionalText(10),
        location: optionalText(120),
        mileageKm: nullableInteger,
        keyCount: z.number().int().min(0).max(20).nullable(),
        summerWheelsIncluded: z.boolean(),
        winterWheelsIncluded: z.boolean(),
        notes: optionalText(1000),
      })
      .strict(),
    additionalTerms: optionalText(5000),
  })
  .strict();

export type AgreementInput = z.infer<typeof agreementInputSchema>;

export const agreementUpdateSchema = agreementInputSchema.extend({
  version: z.number().int().positive(),
});

export const agreementGenerateSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
