import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { accountApplication, auditLog, company, companyInvitation } from "@/server/db/schema";
import { getEmailTransport, sendInvitationEmail } from "@/server/email";
import { renderAccountApplicationNotification, renderAccountApplicationReceipt, renderAccountApplicationRejection, type AccountApplication } from "@/server/email/templates/account-application";
import { AccessError } from "@/server/security";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function submitAccountApplication(input: AccountApplication) {
  const [created] = await getDb().insert(accountApplication).values(input).returning().catch((error: unknown) => {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new AccessError(409, "ACCOUNT_APPLICATION_PENDING");
    }
    throw error;
  });
  const transport = getEmailTransport();
  const notification = renderAccountApplicationNotification(input);
  await transport.send({
    from: "Trejder kontoansökan <noreply@trejder.se>",
    to: "ansokan@trejder.se",
    ...notification,
  });
  const receipt = renderAccountApplicationReceipt({ firstName: input.firstName });
  await transport.send({
    from: "Trejder <noreply@trejder.se>",
    to: input.email,
    ...receipt,
  });
  return created;
}

export async function listAccountApplications() {
  return getDb().select().from(accountApplication).orderBy(desc(accountApplication.createdAt));
}

export async function approveAccountApplication(input: { applicationId: string; actorUserId: string }) {
  const token = randomBytes(32).toString("base64url");
  return getDb().transaction(async (tx) => {
    const [application] = await tx.select().from(accountApplication)
      .where(eq(accountApplication.id, input.applicationId)).for("update");
    if (!application) throw new AccessError(404, "ACCOUNT_APPLICATION_NOT_FOUND");
    if (application.status !== "pending") throw new AccessError(409, "ACCOUNT_APPLICATION_ALREADY_REVIEWED");
    const [createdCompany] = await tx.insert(company).values({
      legalName: application.companyName,
      organizationNumber: application.organizationNumber,
      contactEmail: application.email,
      contactPhone: application.phone,
    }).returning({ id: company.id });
    const [invitation] = await tx.insert(companyInvitation).values({
      companyId: createdCompany.id, email: application.email, role: "admin",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      invitedByUserId: input.actorUserId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    }).returning({ id: companyInvitation.id });
    await sendInvitationEmail({ email: application.email, token, from: "Trejder <konto@trejder.se>" });
    const [updated] = await tx.update(accountApplication).set({
      status: "approved", reviewedByUserId: input.actorUserId, reviewedAt: new Date(),
    }).where(eq(accountApplication.id, application.id)).returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId, actorCompanyId: createdCompany.id,
      action: "platform.account_application.approved", aggregateType: "account_application",
      aggregateId: application.id, metadata: { invitationId: invitation.id },
    });
    return updated;
  }).catch((error: unknown) => {
    if (error instanceof AccessError) throw error;
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new AccessError(409, "ORGANIZATION_NUMBER_EXISTS");
    }
    throw error;
  });
}

export async function rejectAccountApplication(input: { applicationId: string; actorUserId: string }) {
  return getDb().transaction(async (tx) => {
    const [application] = await tx.select().from(accountApplication)
      .where(eq(accountApplication.id, input.applicationId)).for("update");
    if (!application) throw new AccessError(404, "ACCOUNT_APPLICATION_NOT_FOUND");
    if (application.status !== "pending") throw new AccessError(409, "ACCOUNT_APPLICATION_ALREADY_REVIEWED");
    const message = renderAccountApplicationRejection({ firstName: application.firstName });
    await getEmailTransport().send({ from: "Trejder <noreply@trejder.se>", to: application.email, ...message });
    const [updated] = await tx.update(accountApplication).set({
      status: "rejected", reviewedByUserId: input.actorUserId, reviewedAt: new Date(),
    }).where(eq(accountApplication.id, application.id)).returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: "platform.account_application.rejected", aggregateType: "account_application",
      aggregateId: application.id,
    });
    return updated;
  });
}
