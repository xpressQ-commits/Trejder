import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { auditLog, company } from "@/server/db/schema";
import { AccessError, normalizeEmail } from "@/server/security";

export async function getCompanyContact(companyId: string) {
  const [result] = await getDb()
    .select({
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
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
}) {
  return getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(company)
      .set({
        contactEmail: normalizeEmail(input.contactEmail),
        contactPhone: input.contactPhone.trim(),
        updatedAt: new Date(),
      })
      .where(eq(company.id, input.companyId))
      .returning({
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
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
