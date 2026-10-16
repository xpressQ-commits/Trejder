import { createHash } from "node:crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  calculateAgreementAmounts,
  calculatePaymentSummary,
  type AgreementCompanySnapshot,
} from "@/domain/agreement";
import {
  AGREEMENT_TERMS_VERSION,
  DEFAULT_AGREEMENT_TERMS_SV,
} from "@/domain/agreement-terms";
import { normalizeRegistrationNumber } from "@/domain/registration-number";
import { getDb } from "@/server/db";
import {
  agreement,
  auditLog,
  company,
  match,
} from "@/server/db/schema";
import { listCompanyDeals } from "@/server/deals";
import { AccessError } from "@/server/security";
import {
  createPrivateAgreementObjectKey,
  getImageStorage,
} from "@/server/storage/images";
import type { AgreementInput } from "./http";
import { generateAgreementPdf } from "./pdf";

type AgreementRow = typeof agreement.$inferSelect;

export function toAgreementDto(row: AgreementRow) {
  const safeCompany = {
    legalName: row.companySnapshot.legalName,
    organizationNumber: row.companySnapshot.organizationNumber,
    addressLine1: row.companySnapshot.addressLine1,
    postalCode: row.companySnapshot.postalCode,
    city: row.companySnapshot.city,
    phone: row.companySnapshot.phone,
    email: row.companySnapshot.email,
    vatNumber: row.companySnapshot.vatNumber,
  };
  return {
    id: row.id,
    agreementNumber: row.agreementNumber,
    companyId: row.companyId,
    createdByUserId: row.createdByUserId,
    dealId: row.dealId,
    direction: row.direction,
    status: row.status,
    agreementDate: row.agreementDate,
    companySnapshot: {
      ...safeCompany,
      hasLogo: Boolean(row.companySnapshot.logoObjectKey),
    },
    counterpartySnapshot: row.counterpartySnapshot,
    vehicleSnapshot: row.vehicleSnapshot,
    vatMode: row.vatMode,
    totalAmountOre: row.totalAmountOre,
    netAmountOre: row.netAmountOre,
    vatAmountOre: row.vatAmountOre,
    financeAllocations: row.financeAllocations,
    paymentDetails: row.paymentDetails,
    handoverSnapshot: row.handoverSnapshot,
    additionalTerms: row.additionalTerms,
    termsVersion: row.termsVersion,
    version: row.version,
    pdfVersion: row.pdfVersion,
    pdfAvailable: Boolean(row.pdfObjectKey),
    pdfUrl: row.pdfObjectKey ? `/api/agreements/${row.id}/pdf` : null,
    generatedAt: row.generatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type AgreementDto = ReturnType<typeof toAgreementDto>;

function prepareInput(input: AgreementInput) {
  const vehicle = {
    ...input.vehicle,
    registrationNumber: normalizeRegistrationNumber(
      input.vehicle.registrationNumber,
    ),
  };
  const amounts = calculateAgreementAmounts(input.totalAmountOre, input.vatMode);
  calculatePaymentSummary(
    amounts.totalOre,
    input.financeAllocations.map((allocation) => ({
      recipient: allocation.recipient,
      amountOre: allocation.amountOre,
    })),
  );
  return { ...input, vehicle, amounts };
}

async function loadCompanySnapshot(
  database: Pick<ReturnType<typeof getDb>, "select">,
  companyId: string,
): Promise<AgreementCompanySnapshot> {
  const [record] = await database
    .select({
      legalName: company.legalName,
      organizationNumber: company.organizationNumber,
      addressLine1: company.addressLine1,
      postalCode: company.postalCode,
      city: company.city,
      phone: company.contactPhone,
      email: company.contactEmail,
      vatNumber: company.vatNumber,
      logoObjectKey: company.logoObjectKey,
      logoMimeType: company.logoMimeType,
    })
    .from(company)
    .where(eq(company.id, companyId))
    .limit(1);
  if (!record) throw new AccessError(404, "COMPANY_NOT_FOUND");
  return {
    legalName: record.legalName,
    organizationNumber: record.organizationNumber,
    addressLine1: record.addressLine1 ?? "",
    postalCode: record.postalCode ?? "",
    city: record.city ?? "",
    phone: record.phone ?? "",
    email: record.email,
    vatNumber: record.vatNumber ?? "",
    logoObjectKey: record.logoObjectKey,
    logoMimeType:
      record.logoMimeType === "image/png" ||
      record.logoMimeType === "image/jpeg"
        ? record.logoMimeType
        : null,
  };
}

async function assertDealBelongsToCompany(
  companyId: string,
  dealId: string | null,
) {
  if (!dealId) return;
  const [record] = await getDb()
    .select({ id: match.id })
    .from(match)
    .where(
      and(
        eq(match.id, dealId),
        or(
          eq(match.sellerCompanyId, companyId),
          eq(match.buyerCompanyId, companyId),
        ),
      ),
    )
    .limit(1);
  if (!record) throw new AccessError(404, "DEAL_NOT_FOUND");
}

function currentStockholmDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(new Date());
}

export async function listAgreements(companyId: string) {
  const rows = await getDb()
    .select()
    .from(agreement)
    .where(eq(agreement.companyId, companyId))
    .orderBy(desc(agreement.createdAt));
  return rows.map(toAgreementDto);
}

export async function getAgreement(companyId: string, agreementId: string) {
  const [row] = await getDb()
    .select()
    .from(agreement)
    .where(
      and(eq(agreement.id, agreementId), eq(agreement.companyId, companyId)),
    )
    .limit(1);
  if (!row) throw new AccessError(404, "AGREEMENT_NOT_FOUND");
  return toAgreementDto(row);
}

export async function listAgreementDealOptions(companyId: string) {
  return listCompanyDeals(companyId);
}

export async function createAgreementDraft(input: {
  companyId: string;
  actorUserId: string;
  values: AgreementInput;
}) {
  const prepared = prepareInput(input.values);
  await assertDealBelongsToCompany(input.companyId, prepared.dealId);
  return getDb().transaction(async (tx) => {
    const companySnapshot = await loadCompanySnapshot(tx, input.companyId);
    const numberResult = await tx.execute(
      sql`SELECT 'TA-' || EXTRACT(YEAR FROM timezone('Europe/Stockholm', now()))::int || '-' || lpad(nextval('trejder_agreement_number_seq')::text, 6, '0') AS agreement_number`,
    );
    const agreementNumber = String(
      (numberResult[0] as { agreement_number: string }).agreement_number,
    );
    const [created] = await tx
      .insert(agreement)
      .values({
        agreementNumber,
        companyId: input.companyId,
        createdByUserId: input.actorUserId,
        dealId: prepared.dealId,
        direction: prepared.direction,
        agreementDate: prepared.agreementDate,
        companySnapshot,
        counterpartySnapshot: prepared.counterparty,
        vehicleSnapshot: prepared.vehicle,
        vatMode: prepared.vatMode,
        totalAmountOre: prepared.amounts.totalOre,
        netAmountOre: prepared.amounts.netOre,
        vatAmountOre: prepared.amounts.vatOre,
        financeAllocations: prepared.financeAllocations,
        paymentDetails: prepared.paymentDetails,
        handoverSnapshot: prepared.handover,
        additionalTerms: prepared.additionalTerms,
        termsVersion: AGREEMENT_TERMS_VERSION,
      })
      .returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "agreement.created",
      aggregateType: "agreement",
      aggregateId: created.id,
      metadata: { agreementNumber, dealId: prepared.dealId },
    });
    return toAgreementDto(created);
  });
}

export async function updateAgreementDraft(input: {
  companyId: string;
  actorUserId: string;
  agreementId: string;
  expectedVersion: number;
  values: AgreementInput;
}) {
  const prepared = prepareInput(input.values);
  await assertDealBelongsToCompany(input.companyId, prepared.dealId);
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(agreement)
      .where(
        and(
          eq(agreement.id, input.agreementId),
          eq(agreement.companyId, input.companyId),
        ),
      )
      .for("update");
    if (!current) throw new AccessError(404, "AGREEMENT_NOT_FOUND");
    if (current.status !== "draft") {
      throw new AccessError(409, "GENERATED_AGREEMENT_IMMUTABLE");
    }
    if (current.version !== input.expectedVersion) {
      throw new AccessError(409, "AGREEMENT_VERSION_CONFLICT");
    }
    const companySnapshot = await loadCompanySnapshot(tx, input.companyId);
    const [updated] = await tx
      .update(agreement)
      .set({
        dealId: prepared.dealId,
        direction: prepared.direction,
        agreementDate: prepared.agreementDate,
        companySnapshot,
        counterpartySnapshot: prepared.counterparty,
        vehicleSnapshot: prepared.vehicle,
        vatMode: prepared.vatMode,
        totalAmountOre: prepared.amounts.totalOre,
        netAmountOre: prepared.amounts.netOre,
        vatAmountOre: prepared.amounts.vatOre,
        financeAllocations: prepared.financeAllocations,
        paymentDetails: prepared.paymentDetails,
        handoverSnapshot: prepared.handover,
        additionalTerms: prepared.additionalTerms,
        termsVersion: AGREEMENT_TERMS_VERSION,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(agreement.id, current.id))
      .returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "agreement.draft_updated",
      aggregateType: "agreement",
      aggregateId: current.id,
    });
    return toAgreementDto(updated);
  });
}

export async function duplicateAgreement(input: {
  companyId: string;
  actorUserId: string;
  agreementId: string;
}) {
  const [source] = await getDb()
    .select()
    .from(agreement)
    .where(
      and(
        eq(agreement.id, input.agreementId),
        eq(agreement.companyId, input.companyId),
      ),
    )
    .limit(1);
  if (!source) throw new AccessError(404, "AGREEMENT_NOT_FOUND");
  return createAgreementDraft({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    values: {
      dealId: source.dealId,
      direction: source.direction,
      agreementDate: currentStockholmDate(),
      counterparty: source.counterpartySnapshot,
      vehicle: source.vehicleSnapshot,
      vatMode: source.vatMode,
      totalAmountOre: source.totalAmountOre,
      financeAllocations: source.financeAllocations,
      paymentDetails: source.paymentDetails,
      handover: source.handoverSnapshot,
      additionalTerms: source.additionalTerms,
    },
  });
}

export async function generateAgreement(input: {
  companyId: string;
  actorUserId: string;
  agreementId: string;
  expectedVersion: number;
}) {
  const [draft] = await getDb()
    .select()
    .from(agreement)
    .where(
      and(
        eq(agreement.id, input.agreementId),
        eq(agreement.companyId, input.companyId),
      ),
    )
    .limit(1);
  if (!draft) throw new AccessError(404, "AGREEMENT_NOT_FOUND");
  if (draft.status !== "draft") {
    throw new AccessError(409, "GENERATED_AGREEMENT_IMMUTABLE");
  }
  if (draft.version !== input.expectedVersion) {
    throw new AccessError(409, "AGREEMENT_VERSION_CONFLICT");
  }
  const missingCompanyFields = [
    ["addressLine1", draft.companySnapshot.addressLine1],
    ["postalCode", draft.companySnapshot.postalCode],
    ["city", draft.companySnapshot.city],
    ["phone", draft.companySnapshot.phone],
  ].filter(([, value]) => !value);
  if (missingCompanyFields.length) {
    throw new AccessError(409, "COMPANY_PROFILE_INCOMPLETE");
  }
  let logo:
    | { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" }
    | undefined;
  if (
    draft.companySnapshot.logoObjectKey &&
    draft.companySnapshot.logoMimeType
  ) {
    logo = {
      bytes: await getImageStorage().read(
        draft.companySnapshot.logoObjectKey,
      ),
      mimeType: draft.companySnapshot.logoMimeType,
    };
  }
  const pdfBytes = await generateAgreementPdf(
    {
      agreementNumber: draft.agreementNumber,
      agreementDate: draft.agreementDate,
      direction: draft.direction,
      company: draft.companySnapshot,
      counterparty: draft.counterpartySnapshot,
      vehicle: draft.vehicleSnapshot,
      vatMode: draft.vatMode,
      totalAmountOre: draft.totalAmountOre,
      netAmountOre: draft.netAmountOre,
      vatAmountOre: draft.vatAmountOre,
      financeAllocations: draft.financeAllocations,
      paymentDetails: draft.paymentDetails,
      handover: draft.handoverSnapshot,
      additionalTerms:
        draft.additionalTerms || DEFAULT_AGREEMENT_TERMS_SV,
    },
    logo,
  );
  const objectKey = createPrivateAgreementObjectKey();
  const checksum = createHash("sha256").update(pdfBytes).digest("hex");
  const storage = getImageStorage();
  await storage.put(objectKey, pdfBytes, "application/pdf");
  try {
    const generated = await getDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(agreement)
        .set({
          status: "generated",
          pdfObjectKey: objectKey,
          pdfChecksumSha256: checksum,
          pdfByteSize: pdfBytes.length,
          pdfVersion: 1,
          generatedAt: new Date(),
          version: draft.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agreement.id, draft.id),
            eq(agreement.companyId, input.companyId),
            eq(agreement.status, "draft"),
            eq(agreement.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!updated) {
        throw new AccessError(409, "AGREEMENT_VERSION_CONFLICT");
      }
      await tx.insert(auditLog).values({
        actorUserId: input.actorUserId,
        actorCompanyId: input.companyId,
        action: "agreement.generated",
        aggregateType: "agreement",
        aggregateId: draft.id,
        metadata: {
          agreementNumber: draft.agreementNumber,
          pdfVersion: 1,
        },
      });
      return updated;
    });
    return toAgreementDto(generated);
  } catch (error) {
    await storage.delete(objectKey).catch(() => undefined);
    throw error;
  }
}

export async function readAgreementPdf(input: {
  companyId: string;
  actorUserId: string;
  agreementId: string;
}) {
  const [record] = await getDb()
    .select({
      id: agreement.id,
      agreementNumber: agreement.agreementNumber,
      agreementDate: agreement.agreementDate,
      registrationNumber: sql<string>`${agreement.vehicleSnapshot}->>'registrationNumber'`,
      objectKey: agreement.pdfObjectKey,
    })
    .from(agreement)
    .where(
      and(
        eq(agreement.id, input.agreementId),
        eq(agreement.companyId, input.companyId),
      ),
    )
    .limit(1);
  if (!record?.objectKey) throw new AccessError(404, "AGREEMENT_PDF_NOT_FOUND");
  const bytes = await getImageStorage().read(record.objectKey);
  await getDb().insert(auditLog).values({
    actorUserId: input.actorUserId,
    actorCompanyId: input.companyId,
    action: "agreement.downloaded",
    aggregateType: "agreement",
    aggregateId: record.id,
    metadata: { agreementNumber: record.agreementNumber },
  });
  const registration = normalizeRegistrationNumber(record.registrationNumber);
  return {
    bytes,
    fileName: `Trejder_Kopeavtal_${registration}_${record.agreementDate}.pdf`,
  };
}
