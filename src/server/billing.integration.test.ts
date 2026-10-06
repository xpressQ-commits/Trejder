import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  auditLog,
  company,
  companyInvitation,
  companyMembership,
  companySubscription,
  processedStripeEvent,
  user,
} from "@/server/db/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(testDatabaseUrl));

integration("Phase 3.5 PostgreSQL billing boundaries", () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const privateCompany = randomUUID();
  const organizationA = `556${companyA.replace(/\D/g, "").padEnd(9, "1").slice(0, 6)}-${companyA.replace(/\D/g, "").padEnd(4, "2").slice(-4)}`;
  const organizationB = `557${companyB.replace(/\D/g, "").padEnd(9, "3").slice(0, 6)}-${companyB.replace(/\D/g, "").padEnd(4, "4").slice(-4)}`;
  const actor = randomUUID();
  const activeA1 = randomUUID();
  const activeA2 = randomUUID();
  const suspendedA = randomUUID();
  const revokedA = randomUUID();
  const activeB = randomUUID();
  const users = [actor, activeA1, activeA2, suspendedA, revokedA, activeB];
  const stripeCustomerA = `cus_${companyA.replaceAll("-", "")}`;
  const stripeSubscriptionA = `sub_${companyA.replaceAll("-", "")}`;
  const stripeEventIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.insert(user).values(users.map((id, index) => ({
      id,
      name: `Billing test ${index}`,
      email: `billing-${id}@example.test`,
      emailVerified: true,
    })));
    await db.insert(company).values([
      {
        id: companyA,
        legalName: "Trejder Billing A",
        organizationNumber: organizationA,
        contactEmail: `a-${companyA}@example.test`,
        contactPhone: "+46 70-123 45 67",
      },
      {
        id: companyB,
        legalName: "Trejder Billing B",
        organizationNumber: organizationB,
        contactEmail: `b-${companyB}@example.test`,
        contactPhone: "08-765 43 21",
      },
      {
        id: privateCompany,
        legalName: "Trejder Billing Privat",
        organizationNumber: `PRIVATE-${privateCompany.slice(0, 12)}`,
        contactEmail: `private-${privateCompany}@example.test`,
        kind: "private",
      },
    ]);
    await db.insert(companyMembership).values([
      { companyId: companyA, userId: activeA1, role: "admin", status: "active" },
      { companyId: companyA, userId: activeA2, role: "trader", status: "active" },
      { companyId: companyA, userId: suspendedA, role: "trader", status: "suspended" },
      { companyId: companyA, userId: revokedA, role: "viewer", status: "revoked" },
      { companyId: companyB, userId: activeB, role: "admin", status: "active" },
    ]);
    await db.insert(companySubscription).values({
      companyId: companyA,
      stripeCustomerId: stripeCustomerA,
      stripeSubscriptionId: stripeSubscriptionA,
      stripeStatus: "active",
    });
    await db.insert(companyInvitation).values({
      companyId: companyA,
      email: `pending-${companyA}@example.test`,
      role: "trader",
      tokenHash: randomUUID().replaceAll("-", ""),
      invitedByUserId: actor,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  });

  afterAll(async () => {
    const { getDb } = await import("@/server/db");
    const db = getDb();
    const companyIds = [companyA, companyB, privateCompany];
    if (stripeEventIds.length) {
      await db.delete(processedStripeEvent).where(inArray(processedStripeEvent.eventId, stripeEventIds));
    }
    await db.delete(auditLog).where(inArray(auditLog.actorCompanyId, companyIds));
    await db.delete(companyInvitation).where(inArray(companyInvitation.companyId, companyIds));
    await db.delete(companySubscription).where(inArray(companySubscription.companyId, companyIds));
    await db.delete(companyMembership).where(inArray(companyMembership.companyId, companyIds));
    await db.delete(company).where(inArray(company.id, companyIds));
    await db.delete(user).where(inArray(user.id, users));
  });

  it("counts only active memberships and never pending invitations or another company", async () => {
    const { countActiveCompanyMemberships, getPlatformCompanyBillingDetail } = await import("./billing");

    await expect(countActiveCompanyMemberships(companyA)).resolves.toBe(2);
    const detail = await getPlatformCompanyBillingDetail(companyA);
    expect(detail.subscription).toMatchObject({
      activeUsers: 2,
      includedUsers: 2,
      extraUsers: 0,
      extraMonthlyExVatOre: 0,
    });
    expect(detail.users).toHaveLength(4);
    expect(detail.users.filter((member) => member.billableSeat)).toHaveLength(2);
    expect(detail.users.some((member) => member.email === `billing-${activeB}@example.test`)).toBe(false);
  });

  it("searches normalized dealer fields server-side and keeps pagination bounded", async () => {
    const { listPlatformCompaniesPage } = await import("./platform-companies");

    const byName = await listPlatformCompaniesPage({ query: "TREJDER BILLING A", page: 1, pageSize: 25 });
    expect(byName.companies.map((item) => item.id)).toEqual([companyA]);

    const byOrganization = await listPlatformCompaniesPage({
      query: organizationB.replace(/\D/g, ""),
      page: 1,
      pageSize: 25,
    });
    expect(byOrganization.companies.map((item) => item.id)).toEqual([companyB]);

    const byPhone = await listPlatformCompaniesPage({ query: "46701234567", page: 1, pageSize: 25 });
    expect(byPhone.companies.map((item) => item.id)).toEqual([companyA]);

    const firstPage = await listPlatformCompaniesPage({ query: "Trejder Billing", page: 1, pageSize: 1 });
    const secondPage = await listPlatformCompaniesPage({ query: "Trejder Billing", page: 2, pageSize: 1 });
    expect(firstPage.total).toBe(2);
    expect(firstPage.totalPages).toBe(2);
    expect(new Set([...firstPage.companies, ...secondPage.companies].map((item) => item.id)))
      .toEqual(new Set([companyA, companyB]));
    expect([...firstPage.companies, ...secondPage.companies].some((item) => item.id === privateCompany))
      .toBe(false);
  });

  it("ignores unknown customers even when Stripe metadata names a real company", async () => {
    const eventId = `evt_${randomUUID()}`;
    stripeEventIds.push(eventId);
    const event = {
      id: eventId,
      created: 100,
      type: "customer.subscription.updated",
      data: { object: {
        id: `sub_${randomUUID()}`,
        customer: `cus_${randomUUID()}`,
        status: "active",
        metadata: { trejderCompanyId: companyA },
        items: { data: [] },
      } },
    } as unknown as Stripe.Event;
    const { processStripeEvent } = await import("./stripe");

    await expect(processStripeEvent(event)).resolves.toMatchObject({ ignored: "unknown_customer" });
    const { getDb } = await import("@/server/db");
    const [billing] = await getDb().select({ subscriptionId: companySubscription.stripeSubscriptionId })
      .from(companySubscription).where(eq(companySubscription.companyId, companyA));
    expect(billing.subscriptionId).toBe(stripeSubscriptionA);
  });

  it("handles current invoices once, ignores unrelated/stale invoices and preserves manual override", async () => {
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.update(companySubscription).set({
      override: "manual_block",
      stripeStatus: "active",
      stripeLastEventCreated: 0,
    }).where(eq(companySubscription.companyId, companyA));
    const { processStripeEvent } = await import("./stripe");
    const invoiceEvent = (
      id: string,
      type: "invoice.paid" | "invoice.payment_failed",
      created: number,
      subscriptionId: string,
    ) => ({
      id,
      created,
      type,
      data: { object: {
        id: `in_${id}`,
        customer: stripeCustomerA,
        parent: { subscription_details: { subscription: subscriptionId } },
      } },
    }) as unknown as Stripe.Event;

    const failedId = `evt_${randomUUID()}`;
    stripeEventIds.push(failedId);
    const failed = invoiceEvent(failedId, "invoice.payment_failed", 200, stripeSubscriptionA);
    await expect(processStripeEvent(failed)).resolves.toMatchObject({ replay: false, companyId: companyA });
    await expect(processStripeEvent(failed)).resolves.toEqual({ replay: true });
    let [billing] = await db.select({
      stripeStatus: companySubscription.stripeStatus,
      override: companySubscription.override,
    }).from(companySubscription).where(eq(companySubscription.companyId, companyA));
    expect(billing).toEqual({ stripeStatus: "past_due", override: "manual_block" });
    const failedAudits = await db.select({ id: auditLog.id }).from(auditLog)
      .where(and(
        eq(auditLog.actorCompanyId, companyA),
        eq(auditLog.action, "stripe.invoice_payment_failed"),
      ));
    expect(failedAudits).toHaveLength(1);

    const unrelatedId = `evt_${randomUUID()}`;
    stripeEventIds.push(unrelatedId);
    await expect(processStripeEvent(invoiceEvent(
      unrelatedId,
      "invoice.paid",
      201,
      `sub_${randomUUID()}`,
    ))).resolves.toMatchObject({ ignored: "stale_invoice" });

    const paidId = `evt_${randomUUID()}`;
    stripeEventIds.push(paidId);
    await expect(processStripeEvent(invoiceEvent(
      paidId,
      "invoice.paid",
      202,
      stripeSubscriptionA,
    ))).resolves.toMatchObject({ companyId: companyA });

    const staleId = `evt_${randomUUID()}`;
    stripeEventIds.push(staleId);
    await expect(processStripeEvent(invoiceEvent(
      staleId,
      "invoice.payment_failed",
      201,
      stripeSubscriptionA,
    ))).resolves.toMatchObject({ ignored: "stale_invoice" });
    [billing] = await db.select({
      stripeStatus: companySubscription.stripeStatus,
      override: companySubscription.override,
      seatSyncStatus: companySubscription.seatSyncStatus,
    }).from(companySubscription).where(eq(companySubscription.companyId, companyA));
    expect(billing).toEqual({
      stripeStatus: "active",
      override: "manual_block",
      seatSyncStatus: "pending",
    });
  });

  it("marks seat synchronization only when active membership state changes", async () => {
    const { getDb } = await import("@/server/db");
    const db = getDb();
    const [suspendedMembership] = await db.select({ id: companyMembership.id })
      .from(companyMembership)
      .where(eq(companyMembership.userId, suspendedA));
    const { updateCompanyMembership } = await import("./company/members");
    await db.update(companySubscription).set({
      stripeStatus: "past_due",
      seatSyncStatus: "synced",
      seatSyncGeneration: 0,
    }).where(eq(companySubscription.companyId, companyA));

    await updateCompanyMembership({
      companyId: companyA,
      membershipId: suspendedMembership.id,
      actorUserId: actor,
      status: "active",
    });

    const [billing] = await db.select({
      status: companySubscription.seatSyncStatus,
      generation: companySubscription.seatSyncGeneration,
    })
      .from(companySubscription)
      .where(eq(companySubscription.companyId, companyA));
    expect(billing).toEqual({ status: "pending", generation: 1 });
    const { countActiveCompanyMemberships } = await import("./billing");
    await expect(countActiveCompanyMemberships(companyA)).resolves.toBe(3);
  });

  it("implements replace and extend as distinct free-access operations", async () => {
    const { grantFreeAccess } = await import("./billing");
    const replaced = await grantFreeAccess({
      actorUserId: actor,
      companyId: companyB,
      days: 7,
      mode: "replace",
      reason: "QA",
    });
    const extended = await grantFreeAccess({
      actorUserId: actor,
      companyId: companyB,
      days: 14,
      mode: "extend",
      reason: "QA extension",
    });

    expect(extended.freeAccessEndsAt.getTime() - replaced.freeAccessEndsAt.getTime())
      .toBe(14 * 86_400_000);
  });
});
