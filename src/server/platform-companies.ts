import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";
import type { Role } from "@/domain/authorization";
import type { MembershipState } from "@/domain/membership";
import { getDb } from "@/server/db";
import { account, auditLog, company, companyMembership, companySubscription, platformAdmin, user } from "@/server/db/schema";
import { AccessError, normalizeEmail } from "@/server/security";
import { markSeatSyncPending } from "@/server/billing";
import { calculateBillableSeats, resolveSubscriptionAccess, type BillingOverride, type StripeBillingState } from "@/domain/subscription";

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

export async function listPlatformCompaniesPage(input: { query?: string; page?: number; pageSize?: number }) {
  const page = Number.isSafeInteger(input.page) && input.page! > 0 ? input.page! : 1;
  const pageSize = Number.isSafeInteger(input.pageSize) ? Math.min(Math.max(input.pageSize!, 1), 100) : 25;
  const raw = input.query?.trim().slice(0, 100) ?? "";
  const escapedText = raw.toLocaleLowerCase("sv-SE").replace(/[\\%_]/g, "\\$&");
  const digits = raw.replace(/\D/g, "").slice(0, 20);
  const search = raw ? or(
    sql`lower(${company.legalName}) LIKE ${`%${escapedText}%`} ESCAPE '\\'`,
    ...(digits ? [sql`regexp_replace(${company.organizationNumber}, '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`,
      sql`regexp_replace(coalesce(${company.contactPhone}, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`] : []),
  ) : undefined;
  const where = and(eq(company.kind, "dealer"), search);
  const [totalRow] = await getDb().select({ value: count() }).from(company).where(where);
  const rows = await getDb().select({
    id: company.id, legalName: company.legalName, organizationNumber: company.organizationNumber,
    contactEmail: company.contactEmail, contactPhone: company.contactPhone, createdAt: company.createdAt,
    activeUserCount: count(companyMembership.id),
    stripeStatus: companySubscription.stripeStatus, stripePeriodEnd: companySubscription.stripePeriodEnd,
    freeAccessEndsAt: companySubscription.freeAccessEndsAt, override: companySubscription.override,
    stripeCustomerId: companySubscription.stripeCustomerId,
  }).from(company)
    .leftJoin(companyMembership, and(eq(companyMembership.companyId, company.id), eq(companyMembership.status, "active")))
    .leftJoin(companySubscription, eq(companySubscription.companyId, company.id))
    .where(where).groupBy(company.id, companySubscription.companyId)
    .orderBy(asc(company.legalName), desc(company.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  return {
    companies: rows.map((row) => {
      const access = resolveSubscriptionAccess({ override: (row.override ?? null) as BillingOverride, freeAccessEndsAt: row.freeAccessEndsAt, stripeState: (row.stripeStatus ?? "none") as StripeBillingState });
      return { ...row, ...access, ...calculateBillableSeats(row.activeUserCount), hasStripeCustomer: Boolean(row.stripeCustomerId) };
    }),
    page, pageSize, total: totalRow.value, totalPages: Math.max(1, Math.ceil(totalRow.value / pageSize)), query: raw,
  };
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
    await markSeatSyncPending(input.companyId, tx);
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

export async function createPlatformUser(input: {
  actorUserId: string;
  email: string;
  password: string;
  authority: "platform_admin" | Role;
  companyId?: string;
}) {
  const email = normalizeEmail(input.email);
  if (input.password.length < 12 || input.password.length > 128) {
    throw new AccessError(400, "INVALID_PASSWORD");
  }
  if (input.authority !== "platform_admin" && !input.companyId) {
    throw new AccessError(400, "COMPANY_REQUIRED_FOR_DEALER_ROLE");
  }
  return getDb().transaction(async (tx) => {
    let targetCompanyId: string | undefined;
    if (input.authority !== "platform_admin") {
      const [targetCompany] = await tx.select({ id: company.id }).from(company)
        .where(and(eq(company.id, input.companyId!), eq(company.status, "active"))).for("update");
      if (!targetCompany) throw new AccessError(404, "COMPANY_NOT_FOUND");
      targetCompanyId = targetCompany.id;
    }
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
    if (input.authority === "platform_admin") {
      await tx.insert(platformAdmin).values({ userId });
    } else {
      await tx.insert(companyMembership).values({
        companyId: targetCompanyId!, userId, role: input.authority, status: "active",
      });
      await markSeatSyncPending(targetCompanyId!, tx);
    }
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: targetCompanyId,
      action: "platform.user.created",
      aggregateType: "user",
      aggregateId: userId,
      metadata: { authority: input.authority },
    });
    return { id: userId, email, authority: input.authority, companyId: targetCompanyId ?? null };
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
    if (target.status !== updated.status) await markSeatSyncPending(input.companyId, tx);
    return updated;
  });
}
