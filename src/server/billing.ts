import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  calculateBillableSeats,
  resolveSubscriptionAccess,
  type BillingOverride,
  type StripeBillingState,
} from "@/domain/subscription";
import { getDb } from "@/server/db";
import {
  auditLog,
  company,
  companyMembership,
  companySubscription,
  user,
} from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { isBillingExempt } from "@/domain/company-policy";

export const MAX_FREE_ACCESS_DAYS = 3_650;

export async function getCompanySubscriptionAccess(
  companyId: string,
  now = new Date(),
) {
  const [row] = await getDb()
    .select({
      isPlatformOwner: company.isPlatformOwner,
      override: companySubscription.override,
      freeAccessEndsAt: companySubscription.freeAccessEndsAt,
      freeReason: companySubscription.freeReason,
      stripeStatus: companySubscription.stripeStatus,
    })
    .from(company)
    .leftJoin(
      companySubscription,
      eq(companySubscription.companyId, company.id),
    )
    .where(eq(company.id, companyId))
    .limit(1);
  return resolveSubscriptionAccess(
    {
      billingExempt: row?.isPlatformOwner ?? false,
      override: (row?.override ?? null) as BillingOverride,
      freeAccessEndsAt: row?.freeAccessEndsAt ?? null,
      stripeState: (row?.stripeStatus ?? "none") as StripeBillingState,
    },
    now,
  );
}

export async function markSeatSyncPending(
  companyId: string,
  executor = getDb(),
) {
  const [target] = await executor
    .select({ isPlatformOwner: company.isPlatformOwner })
    .from(company)
    .where(eq(company.id, companyId))
    .limit(1);
  if (target && isBillingExempt(target)) return;
  await executor
    .update(companySubscription)
    .set({
      seatSyncStatus: "pending",
      seatSyncLastError: null,
      seatSyncGeneration: sql`${companySubscription.seatSyncGeneration} + 1`,
      seatSyncUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(companySubscription.companyId, companyId),
        inArray(companySubscription.stripeStatus, ["active", "past_due"]),
        isNotNull(companySubscription.stripeSubscriptionId),
      ),
    );
}

export async function getPlatformCompanyBillingDetail(companyId: string) {
  const [target] = await getDb()
    .select({
      id: company.id,
      legalName: company.legalName,
      organizationNumber: company.organizationNumber,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
      isPlatformOwner: company.isPlatformOwner,
      createdAt: company.createdAt,
      stripeCustomerId: companySubscription.stripeCustomerId,
      stripeSubscriptionId: companySubscription.stripeSubscriptionId,
      stripeStatus: companySubscription.stripeStatus,
      stripePeriodEnd: companySubscription.stripePeriodEnd,
      freeAccessStartsAt: companySubscription.freeAccessStartsAt,
      freeAccessEndsAt: companySubscription.freeAccessEndsAt,
      override: companySubscription.override,
      overrideReason: companySubscription.overrideReason,
      seatSyncStatus: companySubscription.seatSyncStatus,
    })
    .from(company)
    .leftJoin(
      companySubscription,
      eq(companySubscription.companyId, company.id),
    )
    .where(and(eq(company.id, companyId), eq(company.kind, "dealer")))
    .limit(1);
  if (!target) throw new AccessError(404, "COMPANY_NOT_FOUND");
  const members = await getDb()
    .select({
      id: companyMembership.id,
      name: user.name,
      email: user.email,
      role: companyMembership.role,
      status: companyMembership.status,
    })
    .from(companyMembership)
    .innerJoin(user, eq(user.id, companyMembership.userId))
    .where(eq(companyMembership.companyId, companyId));
  const activeCount = members.filter(
    (member) => member.status === "active",
  ).length;
  const access = resolveSubscriptionAccess({
    billingExempt: target.isPlatformOwner,
    override: (target.override ?? null) as BillingOverride,
    freeAccessEndsAt: target.freeAccessEndsAt,
    stripeState: (target.stripeStatus ?? "none") as StripeBillingState,
  });
  return {
    company: target,
    subscription: {
      ...access,
      ...calculateBillableSeats(activeCount, target.isPlatformOwner),
    },
    users: members.map((member) => ({
      ...member,
      billableSeat: member.status === "active" && !target.isPlatformOwner,
    })),
  };
}

export async function getCompanyBillingSummary(companyId: string) {
  const [row] = await getDb()
    .select({
      isPlatformOwner: company.isPlatformOwner,
      override: companySubscription.override,
      freeAccessEndsAt: companySubscription.freeAccessEndsAt,
      stripeStatus: companySubscription.stripeStatus,
      stripePeriodEnd: companySubscription.stripePeriodEnd,
      stripeCustomerId: companySubscription.stripeCustomerId,
      stripeSubscriptionId: companySubscription.stripeSubscriptionId,
      seatSyncStatus: companySubscription.seatSyncStatus,
    })
    .from(company)
    .leftJoin(
      companySubscription,
      eq(companySubscription.companyId, company.id),
    )
    .where(eq(company.id, companyId))
    .limit(1);
  const access = resolveSubscriptionAccess({
    billingExempt: row?.isPlatformOwner ?? false,
    override: (row?.override ?? null) as BillingOverride,
    freeAccessEndsAt: row?.freeAccessEndsAt ?? null,
    stripeState: (row?.stripeStatus ?? "none") as StripeBillingState,
  });
  const activeUsers = await countActiveCompanyMemberships(companyId);
  return {
    ...access,
    freeUntil: row?.freeAccessEndsAt ?? null,
    periodEnd: row?.stripePeriodEnd ?? null,
    hasStripeCustomer: Boolean(row?.stripeCustomerId),
    hasStripeSubscription: Boolean(row?.stripeSubscriptionId),
    stripeStatus: row?.stripeStatus ?? "none",
    seatSyncStatus: row?.seatSyncStatus ?? "synced",
    billingExempt: row?.isPlatformOwner ?? false,
    ...calculateBillableSeats(activeUsers, row?.isPlatformOwner ?? false),
  };
}

function validateDays(days: number) {
  if (!Number.isSafeInteger(days) || days < 1 || days > MAX_FREE_ACCESS_DAYS) {
    throw new AccessError(400, "INVALID_FREE_DAYS");
  }
}

export async function grantFreeAccess(input: {
  actorUserId: string;
  companyId: string;
  days: number;
  mode: "replace" | "extend";
  reason?: string;
}) {
  validateDays(input.days);
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: company.id })
      .from(company)
      .where(and(eq(company.id, input.companyId), eq(company.kind, "dealer")))
      .for("update");
    if (!target) throw new AccessError(404, "COMPANY_NOT_FOUND");
    const [before] = await tx
      .select()
      .from(companySubscription)
      .where(eq(companySubscription.companyId, input.companyId))
      .for("update");
    if (
      before?.stripeSubscriptionId &&
      before.stripeStatus !== "none" &&
      before.stripeStatus !== "canceled"
    ) {
      throw new AccessError(409, "ACTIVE_STRIPE_SUBSCRIPTION");
    }
    const base =
      input.mode === "extend" &&
      before?.freeAccessEndsAt &&
      before.freeAccessEndsAt > now
        ? before.freeAccessEndsAt
        : now;
    const end = new Date(base.getTime() + input.days * 86_400_000);
    const previousEffectiveStatus = resolveSubscriptionAccess(
      {
        override: (before?.override ?? null) as BillingOverride,
        freeAccessEndsAt: before?.freeAccessEndsAt ?? null,
        stripeState: (before?.stripeStatus ?? "none") as StripeBillingState,
      },
      now,
    ).status;
    const values = {
      freeAccessStartsAt:
        input.mode === "extend" && before?.freeAccessStartsAt
          ? before.freeAccessStartsAt
          : now,
      freeAccessEndsAt: end,
      freeGrantedByUserId: input.actorUserId,
      freeGrantedAt: now,
      override: null,
      overrideReason: null,
      freeReason: input.reason?.trim() || null,
      overrideByUserId: null,
      overrideAt: null,
      updatedAt: now,
    } as const;
    await tx
      .insert(companySubscription)
      .values({ companyId: input.companyId, ...values })
      .onConflictDoUpdate({
        target: companySubscription.companyId,
        set: values,
      });
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action:
        input.mode === "extend"
          ? "subscription.free_extended"
          : "subscription.free_granted",
      aggregateType: "company_subscription",
      aggregateId: input.companyId,
      metadata: {
        previousEffectiveStatus,
        newEffectiveStatus: "GRATIS",
        previousFreeUntil: before?.freeAccessEndsAt?.toISOString() ?? null,
        freeUntil: end.toISOString(),
        days: input.days,
        reason: input.reason?.trim() || null,
      },
    });
    return { freeAccessEndsAt: end };
  });
}

async function setManualOverride(input: {
  actorUserId: string;
  companyId: string;
  override: Exclude<BillingOverride, null>;
  reason?: string;
}) {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: company.id })
      .from(company)
      .where(and(eq(company.id, input.companyId), eq(company.kind, "dealer")))
      .for("update");
    if (!target) throw new AccessError(404, "COMPANY_NOT_FOUND");
    const [before] = await tx
      .select()
      .from(companySubscription)
      .where(eq(companySubscription.companyId, input.companyId))
      .for("update");
    const previousEffectiveStatus = resolveSubscriptionAccess(
      {
        override: (before?.override ?? null) as BillingOverride,
        freeAccessEndsAt: before?.freeAccessEndsAt ?? null,
        stripeState: (before?.stripeStatus ?? "none") as StripeBillingState,
      },
      now,
    ).status;
    const values = {
      override: input.override,
      overrideReason: input.reason?.trim() || null,
      overrideByUserId: input.actorUserId,
      overrideAt: now,
      updatedAt: now,
    } as const;
    await tx
      .insert(companySubscription)
      .values({ companyId: input.companyId, ...values })
      .onConflictDoUpdate({
        target: companySubscription.companyId,
        set: values,
      });
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action:
        input.override === "manual_block"
          ? "subscription.manual_unpaid"
          : "subscription.manual_premium_granted",
      aggregateType: "company_subscription",
      aggregateId: input.companyId,
      metadata: {
        previousEffectiveStatus,
        newEffectiveStatus:
          input.override === "manual_block" ? "OBETALD" : "PREMIUM",
        previousOverride: before?.override ?? null,
        override: input.override,
        reason: input.reason?.trim() || null,
      },
    });
    return { override: input.override };
  });
}

export const grantManualPremium = (
  input: Omit<Parameters<typeof setManualOverride>[0], "override">,
) => setManualOverride({ ...input, override: "manual_premium" });
export const setManualUnpaid = (
  input: Omit<Parameters<typeof setManualOverride>[0], "override">,
) => setManualOverride({ ...input, override: "manual_block" });

export async function removeSubscriptionOverride(input: {
  actorUserId: string;
  companyId: string;
}) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(companySubscription)
      .where(eq(companySubscription.companyId, input.companyId))
      .for("update");
    if (!before) throw new AccessError(404, "COMPANY_NOT_FOUND");
    const now = new Date();
    const previousEffectiveStatus = resolveSubscriptionAccess(
      {
        override: before.override as BillingOverride,
        freeAccessEndsAt: before.freeAccessEndsAt,
        stripeState: before.stripeStatus as StripeBillingState,
      },
      now,
    ).status;
    const newEffectiveStatus = resolveSubscriptionAccess(
      {
        override: null,
        freeAccessEndsAt: before.freeAccessEndsAt,
        stripeState: before.stripeStatus as StripeBillingState,
      },
      now,
    ).status;
    await tx
      .update(companySubscription)
      .set({
        override: null,
        overrideReason: null,
        overrideByUserId: null,
        overrideAt: null,
        updatedAt: new Date(),
      })
      .where(eq(companySubscription.companyId, input.companyId));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "subscription.override_removed",
      aggregateType: "company_subscription",
      aggregateId: input.companyId,
      metadata: {
        previousEffectiveStatus,
        newEffectiveStatus,
        previousOverride: before.override,
      },
    });
    return { override: null };
  });
}

export async function countActiveCompanyMemberships(companyId: string) {
  const [result] = await getDb()
    .select({ value: count() })
    .from(companyMembership)
    .where(
      and(
        eq(companyMembership.companyId, companyId),
        eq(companyMembership.status, "active"),
      ),
    );
  return result.value;
}
