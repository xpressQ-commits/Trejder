import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { auditLog, company } from "@/server/db/schema";
import { AccessError, normalizeEmail } from "@/server/security";

export async function getCompanyContact(companyId: string) {
  const [result] = await getDb()
    .select({
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
      addressLine1: company.addressLine1,
      postalCode: company.postalCode,
      city: company.city,
      vatNumber: company.vatNumber,
      hasLogo: sql<boolean>`${company.logoObjectKey} IS NOT NULL`,
    })
    .from(company)
    .where(eq(company.id, companyId))
    .limit(1);
  if (!result) throw new AccessError(404, "COMPANY_NOT_FOUND");
  return result;
}

export async function updateCompanyContact(input: {
  actorUserId: string;
  companyId: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  vatNumber: string;
}) {
  return getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(company)
      .set({
        contactEmail: normalizeEmail(input.contactEmail),
        contactPhone: input.contactPhone.trim(),
        addressLine1: input.addressLine1.trim() || null,
        postalCode: input.postalCode.trim() || null,
        city: input.city.trim() || null,
        vatNumber: input.vatNumber.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(company.id, input.companyId))
      .returning({
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
        addressLine1: company.addressLine1,
        postalCode: company.postalCode,
        city: company.city,
        vatNumber: company.vatNumber,
      });
    if (!updated) throw new AccessError(404, "COMPANY_NOT_FOUND");
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "company.contact_updated",
      aggregateType: "company",
      aggregateId: input.companyId,
    });
    return updated;
  });
}

export async function getCompanyLogo(companyId: string) {
  const [result] = await getDb()
    .select({
      objectKey: company.logoObjectKey,
      mimeType: company.logoMimeType,
    })
    .from(company)
    .where(eq(company.id, companyId))
    .limit(1);
  if (!result) throw new AccessError(404, "COMPANY_NOT_FOUND");
  if (!result.objectKey || result.mimeType !== "image/png") {
    throw new AccessError(404, "COMPANY_LOGO_NOT_FOUND");
  }
  return { objectKey: result.objectKey, mimeType: "image/png" as const };
}

export async function replaceCompanyLogo(input: {
  actorUserId: string;
  companyId: string;
  objectKey: string;
}) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ objectKey: company.logoObjectKey })
      .from(company)
      .where(eq(company.id, input.companyId))
      .for("update");
    if (!current) throw new AccessError(404, "COMPANY_NOT_FOUND");
    await tx
      .update(company)
      .set({
        logoObjectKey: input.objectKey,
        logoMimeType: "image/png",
        updatedAt: new Date(),
      })
      .where(eq(company.id, input.companyId));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "company.logo_updated",
      aggregateType: "company",
      aggregateId: input.companyId,
    });
    return { previousObjectKey: current.objectKey };
  });
}
