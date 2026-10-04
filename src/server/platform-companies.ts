import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { Role } from "@/domain/authorization";
import type { MembershipState } from "@/domain/membership";
import { getDb } from "@/server/db";
import { account, auditLog, company, companyMembership, user } from "@/server/db/schema";
import { AccessError, normalizeEmail } from "@/server/security";

export async function listPlatformCompanies() {
  return getDb().select({
    id: company.id,
    legalName: company.legalName,
    organizationNumber: company.organizationNumber,
    contactEmail: company.contactEmail,
    status: company.status,
    memberCount: count(companyMembership.id),
  }).from(company)
    .leftJoin(companyMembership, and(
      eq(companyMembership.companyId, company.id),
      eq(companyMembership.status, "active"),
    ))
    .groupBy(company.id)
    .orderBy(asc(company.legalName));
}

export async function createPlatformCompany(input: {
  actorUserId: string;
  legalName: string;
  organizationNumber: string;
  contactEmail: string;
}) {
  return getDb().transaction(async (tx) => {
    const [created] = await tx.insert(company).values({
      legalName: input.legalName.trim(),
      organizationNumber: input.organizationNumber.trim(),
      contactEmail: normalizeEmail(input.contactEmail),
    }).returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: created.id,
      action: "platform.company.created",
      aggregateType: "company",
      aggregateId: created.id,
    });
    return created;
  }).catch((error: unknown) => {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new AccessError(409, "ORGANIZATION_NUMBER_EXISTS");
    }
    throw error;
  });
}

export async function updatePlatformCompany(input: {
  actorUserId: string;
  companyId: string;
  legalName?: string;
  organizationNumber?: string;
  contactEmail?: string;
  status?: "active" | "suspended";
}) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(company)
      .where(eq(company.id, input.companyId)).for("update");
    if (!current) throw new AccessError(404, "COMPANY_NOT_FOUND");
    const [updated] = await tx.update(company).set({
      legalName: input.legalName?.trim() ?? current.legalName,
      organizationNumber: input.organizationNumber?.trim() ?? current.organizationNumber,
      contactEmail: input.contactEmail ? normalizeEmail(input.contactEmail) : current.contactEmail,
      status: input.status ?? current.status,
      updatedAt: new Date(),
    }).where(eq(company.id, current.id)).returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: current.id,
      action: "platform.company.updated",
      aggregateType: "company",
      aggregateId: current.id,
      metadata: {
        previousStatus: current.status,
        status: updated.status,
        previousOrganizationNumber: current.organizationNumber,
        organizationNumber: updated.organizationNumber,
      },
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

export async function listPlatformCompanyMembers(companyId: string) {
  const [target] = await getDb().select({ id: company.id }).from(company)
    .where(eq(company.id, companyId)).limit(1);
  if (!target) throw new AccessError(404, "COMPANY_NOT_FOUND");
  return getDb().select({
    id: companyMembership.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: companyMembership.role,
    status: companyMembership.status,
  }).from(companyMembership)
    .innerJoin(user, eq(user.id, companyMembership.userId))
    .where(eq(companyMembership.companyId, companyId))
    .orderBy(asc(user.name));
}

export async function createPlatformCompanyMember(input: {
  actorUserId: string;
  companyId: string;
  email: string;
  password: string;
  role: Role;
}) {
  const email = normalizeEmail(input.email);
  if (input.password.length < 12 || input.password.length > 128) {
    throw new AccessError(400, "INVALID_PASSWORD");
  }
  return getDb().transaction(async (tx) => {
    const [targetCompany] = await tx.select({ id: company.id }).from(company)
      .where(eq(company.id, input.companyId)).for("update");
    if (!targetCompany) throw new AccessError(404, "COMPANY_NOT_FOUND");
    const [existing] = await tx.select({ id: user.id }).from(user)
      .where(sql`lower(${user.email}) = ${email}`).limit(1);
    if (existing) throw new AccessError(409, "USER_EMAIL_EXISTS");

    const userId = randomUUID();
    const displayName = email.split("@")[0].replace(/[._-]+/g, " ").trim() || "Trejder-användare";
    await tx.insert(user).values({ id: userId, name: displayName, email, emailVerified: true });
    await tx.insert(account).values({
      id: randomUUID(), accountId: userId, providerId: "credential", userId,
      password: await hashPassword(input.password),
    });
    const [membership] = await tx.insert(companyMembership).values({
      companyId: input.companyId, userId, role: input.role, status: "active",
    }).returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "platform.company_membership.created",
      aggregateType: "company_membership",
      aggregateId: membership.id,
      metadata: { role: input.role },
    });
    return membership;
  }).catch((error: unknown) => {
    if (error instanceof AccessError) throw error;
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new AccessError(409, "USER_EMAIL_EXISTS");
    }
    throw error;
  });
}

export async function updatePlatformCompanyMembership(input: {
  actorUserId: string;
  companyId: string;
  membershipId: string;
  role?: Role;
  status?: MembershipState;
}) {
  return getDb().transaction(async (tx) => {
    const [target] = await tx.select().from(companyMembership).where(and(
      eq(companyMembership.id, input.membershipId),
      eq(companyMembership.companyId, input.companyId),
    )).for("update");
    if (!target) throw new AccessError(404, "MEMBERSHIP_NOT_FOUND");
    const [updated] = await tx.update(companyMembership).set({
      role: input.role ?? target.role,
      status: input.status ?? target.status,
      updatedAt: new Date(),
    }).where(eq(companyMembership.id, target.id)).returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "platform.company_membership.updated",
      aggregateType: "company_membership",
      aggregateId: target.id,
      metadata: {
        previousRole: target.role,
        previousStatus: target.status,
        role: updated.role,
        status: updated.status,
      },
    });
    return updated;
  });
}
