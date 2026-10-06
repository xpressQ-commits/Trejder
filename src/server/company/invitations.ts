import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import type { Role } from "@/domain/authorization";
import { getDb } from "@/server/db";
import { account, auditLog, company, companyInvitation, companyMembership, user } from "@/server/db/schema";
import { sendInvitationEmail } from "@/server/email";
import { AccessError, constantTimeTextEqual, normalizeEmail } from "@/server/security";
import { markSeatSyncPending } from "@/server/billing";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function inviteCompanyMember(input: {
  companyId: string;
  actorUserId: string;
  email: string;
  role: Role;
}): Promise<{ id: string; email: string; role: Role; expiresAt: Date }> {
  const email = normalizeEmail(input.email);
  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const result = await getDb().transaction(async (tx) => {
    await tx.update(companyInvitation).set({ status: "expired" }).where(and(
      eq(companyInvitation.companyId, input.companyId),
      sql`lower(${companyInvitation.email}) = ${email}`,
      eq(companyInvitation.status, "pending"),
      lte(companyInvitation.expiresAt, new Date()),
    ));
    const [existingUser] = await tx.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`).limit(1);
    if (existingUser) {
      const membership = await tx.query.companyMembership.findFirst({
        where: and(eq(companyMembership.companyId, input.companyId), eq(companyMembership.userId, existingUser.id)),
        columns: { id: true },
      });
      if (membership) throw new AccessError(409, "MEMBERSHIP_ALREADY_EXISTS");
    }
    const [created] = await tx.insert(companyInvitation).values({
      companyId: input.companyId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedByUserId: input.actorUserId,
      expiresAt,
    }).returning({ id: companyInvitation.id, email: companyInvitation.email, role: companyInvitation.role, expiresAt: companyInvitation.expiresAt });
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "company_invitation.created",
      aggregateType: "company_invitation",
      aggregateId: created.id,
      metadata: { role: input.role },
    });
    return created;
  }).catch((error: unknown) => {
    if (error instanceof AccessError) throw error;
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new AccessError(409, "PENDING_INVITATION_EXISTS");
    }
    throw error;
  });
  try {
    await sendInvitationEmail({ email, token });
  } catch (error) {
    await getDb().transaction(async (tx) => {
      await tx.update(companyInvitation).set({ status: "revoked", revokedAt: new Date() })
        .where(and(eq(companyInvitation.id, result.id), eq(companyInvitation.status, "pending")));
      await tx.insert(auditLog).values({
        actorUserId: input.actorUserId, actorCompanyId: input.companyId,
        action: "company_invitation.delivery_failed", aggregateType: "company_invitation", aggregateId: result.id,
      });
    });
    throw error;
  }
  return result;
}

export async function revokeCompanyInvitation(input: { companyId: string; invitationId: string; actorUserId: string }): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [invitation] = await tx.select().from(companyInvitation).where(and(
      eq(companyInvitation.id, input.invitationId), eq(companyInvitation.companyId, input.companyId),
    )).for("update");
    if (!invitation) throw new AccessError(404, "INVITATION_NOT_FOUND");
    if (invitation.status !== "pending") throw new AccessError(409, "INVITATION_NOT_PENDING");
    await tx.update(companyInvitation).set({ status: "revoked", revokedAt: new Date() }).where(eq(companyInvitation.id, invitation.id));
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.companyId, action: "company_invitation.revoked", aggregateType: "company_invitation", aggregateId: invitation.id });
  });
}

export async function acceptCompanyInvitation(input: {
  token: string;
  authenticatedUser: { id: string; email: string } | null;
  name?: string;
  password?: string;
}): Promise<{ companyId: string; requiresSignIn: boolean }> {
  if (input.token.length < 32) throw new AccessError(404, "INVALID_INVITATION");
  const outcome = await getDb().transaction(async (tx) => {
    const [invitation] = await tx.select().from(companyInvitation)
      .where(eq(companyInvitation.tokenHash, hashToken(input.token))).for("update");
    if (!invitation || invitation.status !== "pending") throw new AccessError(404, "INVALID_INVITATION");
    if (invitation.expiresAt <= new Date()) {
      await tx.update(companyInvitation).set({ status: "expired" }).where(eq(companyInvitation.id, invitation.id));
      await tx.insert(auditLog).values({
        actorCompanyId: invitation.companyId, action: "company_invitation.expired",
        aggregateType: "company_invitation", aggregateId: invitation.id,
      });
      return { expired: true as const };
    }
    const invitedEmail = normalizeEmail(invitation.email);
    let acceptingUserId: string;
    let requiresSignIn = false;
    const [existing] = await tx.select().from(user).where(sql`lower(${user.email}) = ${invitedEmail}`).limit(1);
    if (existing) {
      if (!input.authenticatedUser || !constantTimeTextEqual(normalizeEmail(input.authenticatedUser.email), invitedEmail) || input.authenticatedUser.id !== existing.id) {
        throw new AccessError(401, "SIGN_IN_AS_INVITED_USER_REQUIRED");
      }
      acceptingUserId = existing.id;
    } else {
      if (input.authenticatedUser) throw new AccessError(403, "INVITATION_EMAIL_MISMATCH");
      if (!input.name?.trim() || !input.password || input.password.length < 12 || input.password.length > 128) {
        throw new AccessError(400, "ACCOUNT_DETAILS_REQUIRED");
      }
      acceptingUserId = randomUUID();
      requiresSignIn = true;
      await tx.insert(user).values({ id: acceptingUserId, name: input.name.trim(), email: invitedEmail, emailVerified: true });
      await tx.insert(account).values({
        id: randomUUID(), accountId: acceptingUserId, providerId: "credential", userId: acceptingUserId,
        password: await hashPassword(input.password),
      });
    }
    const existingMembership = await tx.query.companyMembership.findFirst({ where: and(
      eq(companyMembership.companyId, invitation.companyId), eq(companyMembership.userId, acceptingUserId),
    ) });
    if (existingMembership) {
      await tx.update(companyInvitation).set({ status: "revoked", revokedAt: new Date() }).where(eq(companyInvitation.id, invitation.id));
      await tx.insert(auditLog).values({
        actorUserId: acceptingUserId, actorCompanyId: invitation.companyId,
        action: "company_invitation.redundant", aggregateType: "company_invitation", aggregateId: invitation.id,
      });
      return { alreadyMember: true as const };
    }
    await tx.insert(companyMembership).values({ companyId: invitation.companyId, userId: acceptingUserId, role: invitation.role });
    await markSeatSyncPending(invitation.companyId, tx);
    const consumed = await tx.update(companyInvitation).set({ status: "accepted", acceptedAt: new Date() })
      .where(and(eq(companyInvitation.id, invitation.id), eq(companyInvitation.status, "pending"))).returning({ id: companyInvitation.id });
    if (consumed.length !== 1) throw new AccessError(404, "INVALID_INVITATION");
    await tx.insert(auditLog).values({
      actorUserId: acceptingUserId, actorCompanyId: invitation.companyId, action: "company_invitation.accepted",
      aggregateType: "company_invitation", aggregateId: invitation.id, metadata: { role: invitation.role },
    });
    return { expired: false as const, alreadyMember: false as const, companyId: invitation.companyId, requiresSignIn };
  });
  if (outcome.expired) throw new AccessError(404, "INVALID_INVITATION");
  if (outcome.alreadyMember) throw new AccessError(409, "MEMBERSHIP_ALREADY_EXISTS");
  return { companyId: outcome.companyId, requiresSignIn: outcome.requiresSignIn };
}

export async function listCompanyInvitations(companyId: string) {
  return getDb().select({
    id: companyInvitation.id,
    email: companyInvitation.email,
    role: companyInvitation.role,
    status: companyInvitation.status,
    expiresAt: companyInvitation.expiresAt,
    createdAt: companyInvitation.createdAt,
  }).from(companyInvitation).where(eq(companyInvitation.companyId, companyId));
}

export async function provisionDealerCompany(input: {
  legalName: string; organizationNumber: string; contactEmail: string; initialAdminEmail: string;
}): Promise<{ companyId: string; invitationId: string }> {
  const token = newToken();
  const initialAdminEmail = normalizeEmail(input.initialAdminEmail);
  const result = await getDb().transaction(async (tx) => {
    const [createdCompany] = await tx.insert(company).values({
      legalName: input.legalName.trim(), organizationNumber: input.organizationNumber.trim(), contactEmail: normalizeEmail(input.contactEmail),
    }).returning({ id: company.id });
    const [invitation] = await tx.insert(companyInvitation).values({
      companyId: createdCompany.id, email: initialAdminEmail, role: "admin", tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS), invitedByUserId: null,
    }).returning({ id: companyInvitation.id });
    await tx.insert(auditLog).values({ actorCompanyId: createdCompany.id, action: "company.provisioned", aggregateType: "company", aggregateId: createdCompany.id });
    return { companyId: createdCompany.id, invitationId: invitation.id };
  });
  await sendInvitationEmail({ email: initialAdminEmail, token });
  return result;
}
