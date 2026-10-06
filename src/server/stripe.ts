import Stripe from "stripe";
import { and, count, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { stripeExtraUserQuantity } from "@/domain/subscription";
import { countActiveCompanyMemberships } from "@/server/billing";
import { getDb } from "@/server/db";
import {
  auditLog,
  company,
  companyMembership,
  companySubscription,
  processedStripeEvent,
} from "@/server/db/schema";
import { AccessError } from "@/server/security";

let stripeClient: Stripe | undefined;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new AccessError(503, "BILLING_NOT_CONFIGURED");
  return value;
}

export function getStripeClient() {
  return (stripeClient ??= new Stripe(required("STRIPE_SECRET_KEY"), {
    maxNetworkRetries: 2,
  }));
}

export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
  secret = required("STRIPE_WEBHOOK_SECRET"),
) {
  try {
    return getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      secret,
    );
  } catch {
    throw new AccessError(400, "INVALID_STRIPE_SIGNATURE");
  }
}

function stripeState(
  status: Stripe.Subscription.Status,
): "active" | "past_due" | "unpaid" | "canceled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (
    status === "unpaid" ||
    status === "incomplete" ||
    status === "incomplete_expired" ||
    status === "paused"
  )
    return "unpaid";
  return "canceled";
}

function idOf(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000) : null;
}

export function seatSyncIdempotencyKey(
  companyId: string,
  generation: number,
  desired: number,
  create: boolean,
) {
  return `trejder-seat-${create ? "create-" : ""}${companyId}-${generation}-${desired}`;
}

async function ensureStripeCustomer(companyId: string, actorUserId: string) {
  const [existing] = await getDb()
    .select({ stripeCustomerId: companySubscription.stripeCustomerId })
    .from(companySubscription)
    .where(eq(companySubscription.companyId, companyId))
    .limit(1);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;
  const [target] = await getDb()
    .select({
      legalName: company.legalName,
      contactEmail: company.contactEmail,
    })
    .from(company)
    .where(and(eq(company.id, companyId), eq(company.kind, "dealer")))
    .limit(1);
  if (!target) throw new AccessError(404, "COMPANY_NOT_FOUND");
  const customer = await getStripeClient().customers.create(
    {
      name: target.legalName,
      email: target.contactEmail,
      metadata: { trejderCompanyId: companyId },
    },
    { idempotencyKey: `trejder-customer-${companyId}` },
  );
  await getDb().transaction(async (tx) => {
    let claimed = await tx
      .insert(companySubscription)
      .values({ companyId, stripeCustomerId: customer.id })
      .onConflictDoNothing()
      .returning({ companyId: companySubscription.companyId });
    if (!claimed.length)
      claimed = await tx
        .update(companySubscription)
        .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
        .where(
          and(
            eq(companySubscription.companyId, companyId),
            isNull(companySubscription.stripeCustomerId),
          ),
        )
        .returning({ companyId: companySubscription.companyId });
    if (claimed.length)
      await tx
        .insert(auditLog)
        .values({
          actorUserId,
          actorCompanyId: companyId,
          action: "stripe.customer_created",
          aggregateType: "company_subscription",
          aggregateId: companyId,
          metadata: { stripeCustomerId: customer.id },
        });
  });
  return customer.id;
}

export async function createPremiumCheckout(
  companyId: string,
  actorUserId: string,
) {
  const [billing] = await getDb()
    .select()
    .from(companySubscription)
    .where(eq(companySubscription.companyId, companyId))
    .limit(1);
  if (billing?.override)
    throw new AccessError(409, "SUBSCRIPTION_OVERRIDE_ACTIVE");
  if (billing?.freeAccessEndsAt && billing.freeAccessEndsAt > new Date())
    throw new AccessError(409, "FREE_ACCESS_ACTIVE");
  if (
    billing?.stripeSubscriptionId &&
    billing.stripeStatus !== "canceled" &&
    billing.stripeStatus !== "none"
  )
    throw new AccessError(409, "STRIPE_SUBSCRIPTION_EXISTS");
  const customer = await ensureStripeCustomer(companyId, actorUserId);
  const extraUsers = stripeExtraUserQuantity(
    await countActiveCompanyMemberships(companyId),
  );
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: required("STRIPE_PRICE_PREMIUM_MONTHLY"), quantity: 1 },
  ];
  if (extraUsers > 0)
    lineItems.push({
      price: required("STRIPE_PRICE_EXTRA_USER_MONTHLY"),
      quantity: extraUsers,
    });
  const baseUrl = new URL(required("BETTER_AUTH_URL")).origin;
  return getDb().transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(companySubscription)
      .where(eq(companySubscription.companyId, companyId))
      .for("update");
    if (!locked) throw new AccessError(503, "BILLING_NOT_CONFIGURED");
    if (locked.override)
      throw new AccessError(409, "SUBSCRIPTION_OVERRIDE_ACTIVE");
    if (locked.freeAccessEndsAt && locked.freeAccessEndsAt > new Date())
      throw new AccessError(409, "FREE_ACCESS_ACTIVE");
    if (
      locked.stripeSubscriptionId &&
      locked.stripeStatus !== "canceled" &&
      locked.stripeStatus !== "none"
    )
      throw new AccessError(409, "STRIPE_SUBSCRIPTION_EXISTS");
    if (
      locked.stripeCheckoutStatus === "open" &&
      locked.stripeCheckoutExpiresAt &&
      locked.stripeCheckoutExpiresAt > new Date() &&
      locked.stripeCheckoutSessionUrl
    ) {
      return { url: locked.stripeCheckoutSessionUrl };
    }
    const generation = locked.stripeCheckoutGeneration + 1;
    const session = await getStripeClient().checkout.sessions.create(
      {
        mode: "subscription",
        customer,
        line_items: lineItems,
        success_url: `${baseUrl}/app/installningar?billing=success`,
        cancel_url: `${baseUrl}/app/installningar?billing=cancelled`,
        client_reference_id: companyId,
        subscription_data: { metadata: { trejderCompanyId: companyId } },
        metadata: { trejderCompanyId: companyId },
      },
      { idempotencyKey: `trejder-checkout-${companyId}-${generation}` },
    );
    if (!session.url) throw new AccessError(503, "STRIPE_CHECKOUT_UNAVAILABLE");
    await tx
      .update(companySubscription)
      .set({
        stripeCheckoutSessionId: session.id,
        stripeCheckoutSessionUrl: session.url,
        stripeCheckoutExpiresAt: new Date(session.expires_at * 1000),
        stripeCheckoutStatus: "open",
        stripeCheckoutGeneration: generation,
        updatedAt: new Date(),
      })
      .where(eq(companySubscription.companyId, companyId));
    return { url: session.url };
  });
}

export async function createBillingPortal(companyId: string) {
  const [billing] = await getDb()
    .select({ stripeCustomerId: companySubscription.stripeCustomerId })
    .from(companySubscription)
    .where(eq(companySubscription.companyId, companyId))
    .limit(1);
  if (!billing?.stripeCustomerId)
    throw new AccessError(409, "STRIPE_CUSTOMER_REQUIRED");
  const baseUrl = new URL(required("BETTER_AUTH_URL")).origin;
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${baseUrl}/app/installningar`,
  });
  return { url: session.url };
}

async function companyIdForCustomer(
  customerId: string | null,
  metadataCompanyId?: string,
) {
  if (customerId) {
    const [known] = await getDb()
      .select({ companyId: companySubscription.companyId })
      .from(companySubscription)
      .where(eq(companySubscription.stripeCustomerId, customerId))
      .limit(1);
    if (known && (!metadataCompanyId || metadataCompanyId === known.companyId))
      return known.companyId;
  }
  return null;
}

/** DB-only and idempotent. Network work is deliberately outside webhook transactions. */
export async function processStripeEvent(event: Stripe.Event) {
  return getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(processedStripeEvent)
      .values({ eventId: event.id, eventType: event.type })
      .onConflictDoNothing()
      .returning({ eventId: processedStripeEvent.eventId });
    if (inserted.length === 0) return { replay: true as const };
    if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = await companyIdForCustomer(
        idOf(subscription.customer),
        subscription.metadata.trejderCompanyId,
      );
      if (!companyId)
        return { replay: false as const, ignored: "unknown_customer" as const };
      const status =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : stripeState(subscription.status);
      const extraPrice = process.env.STRIPE_PRICE_EXTRA_USER_MONTHLY;
      const extraItem = extraPrice
        ? subscription.items.data.find(
            (item) => idOf(item.price) === extraPrice,
          )
        : undefined;
      const [activeMembers] = await tx
        .select({ value: count() })
        .from(companyMembership)
        .where(
          and(
            eq(companyMembership.companyId, companyId),
            eq(companyMembership.status, "active"),
          ),
        );
      const desiredExtraUsers = stripeExtraUserQuantity(activeMembers.value);
      const needsSeatSync =
        (status === "active" || status === "past_due") &&
        (extraItem?.quantity ?? 0) !== desiredExtraUsers;
      const [before] = await tx
        .select({
          stripeStatus: companySubscription.stripeStatus,
          stripeSubscriptionId: companySubscription.stripeSubscriptionId,
          stripeLastEventCreated: companySubscription.stripeLastEventCreated,
        })
        .from(companySubscription)
        .where(eq(companySubscription.companyId, companyId))
        .limit(1);
      if (
        before?.stripeSubscriptionId &&
        before.stripeSubscriptionId !== subscription.id &&
        !(
          event.type === "customer.subscription.created" &&
          before.stripeStatus === "canceled"
        )
      ) {
        return {
          replay: false as const,
          ignored: "foreign_subscription" as const,
        };
      }
      if (
        before &&
        (event.created < before.stripeLastEventCreated ||
          (event.created === before.stripeLastEventCreated &&
            before.stripeStatus === "canceled" &&
            status !== "canceled"))
      ) {
        return {
          replay: false as const,
          ignored: "stale_subscription_event" as const,
        };
      }
      await tx
        .insert(companySubscription)
        .values({
          companyId,
          stripeCustomerId: idOf(subscription.customer),
          stripeSubscriptionId: subscription.id,
          stripeExtraItemId: extraItem?.id ?? null,
          stripeStatus: status,
          stripeLastEventCreated: event.created,
          stripePeriodEnd: subscriptionPeriodEnd(subscription),
          seatSyncStatus: needsSeatSync ? "pending" : "synced",
          seatSyncGeneration: needsSeatSync ? 1 : 0,
          lastSyncedSeatQuantity: needsSeatSync ? 0 : desiredExtraUsers,
          seatSyncUpdatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: companySubscription.companyId,
          set: {
            stripeCustomerId: idOf(subscription.customer),
            stripeSubscriptionId: subscription.id,
            stripeExtraItemId: extraItem?.id ?? null,
            stripeStatus: status,
            stripeLastEventCreated: event.created,
            stripePeriodEnd: subscriptionPeriodEnd(subscription),
            seatSyncStatus: needsSeatSync ? "pending" : "synced",
            seatSyncGeneration: needsSeatSync
              ? sql`${companySubscription.seatSyncGeneration} + 1`
              : sql`${companySubscription.seatSyncGeneration}`,
            lastSyncedSeatQuantity: needsSeatSync
              ? sql`${companySubscription.lastSyncedSeatQuantity}`
              : desiredExtraUsers,
            seatSyncUpdatedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      await tx
        .insert(auditLog)
        .values({
          actorCompanyId: companyId,
          action:
            event.type === "customer.subscription.created"
              ? "stripe.subscription_linked"
              : "stripe.subscription_status_changed",
          aggregateType: "company_subscription",
          aggregateId: companyId,
          metadata: {
            stripeSubscriptionId: subscription.id,
            previousStripeStatus: before?.stripeStatus ?? "none",
            newStripeStatus: status,
            stripeEventId: event.id,
          },
        });
      return { replay: false as const, companyId };
    }
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = await companyIdForCustomer(
        idOf(session.customer),
        session.metadata?.trejderCompanyId,
      );
      if (!companyId)
        return { replay: false as const, ignored: "unknown_customer" as const };
      const [current] = await tx
        .select({ sessionId: companySubscription.stripeCheckoutSessionId })
        .from(companySubscription)
        .where(eq(companySubscription.companyId, companyId))
        .limit(1);
      if (current?.sessionId !== session.id)
        return {
          replay: false as const,
          ignored: "stale_checkout_session" as const,
        };
      await tx
        .update(companySubscription)
        .set({
          stripeCheckoutStatus:
            event.type === "checkout.session.completed"
              ? "complete"
              : "expired",
          stripeCheckoutSessionUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(companySubscription.companyId, companyId));
      return { replay: false as const, companyId };
    }
    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = idOf(invoice.customer);
      const companyId = await companyIdForCustomer(customerId);
      if (!companyId)
        return { replay: false as const, ignored: "unknown_customer" as const };
      const [before] = await tx
        .select({
          stripeStatus: companySubscription.stripeStatus,
          stripeSubscriptionId: companySubscription.stripeSubscriptionId,
          stripeLastEventCreated: companySubscription.stripeLastEventCreated,
        })
        .from(companySubscription)
        .where(eq(companySubscription.companyId, companyId))
        .limit(1);
      const invoiceSubscriptionId = idOf(
        invoice.parent?.subscription_details?.subscription ?? null,
      );
      if (
        !before?.stripeSubscriptionId ||
        invoiceSubscriptionId !== before.stripeSubscriptionId ||
        before.stripeStatus === "canceled" ||
        before.stripeStatus === "unpaid" ||
        event.created < before.stripeLastEventCreated
      ) {
        return { replay: false as const, ignored: "stale_invoice" as const };
      }
      const nextStatus = event.type === "invoice.paid" ? "active" : "past_due";
      if (event.type === "invoice.paid") {
        await tx
          .update(companySubscription)
          .set({
            stripeStatus: nextStatus,
            stripeLastEventCreated: event.created,
            seatSyncStatus: "pending",
            seatSyncGeneration: sql`${companySubscription.seatSyncGeneration} + 1`,
            seatSyncUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(companySubscription.companyId, companyId));
      } else {
        await tx
          .update(companySubscription)
          .set({
            stripeStatus: nextStatus,
            stripeLastEventCreated: event.created,
            updatedAt: new Date(),
          })
          .where(eq(companySubscription.companyId, companyId));
      }
      await tx
        .insert(auditLog)
        .values({
          actorCompanyId: companyId,
          action:
            event.type === "invoice.paid"
              ? "stripe.invoice_paid"
              : "stripe.invoice_payment_failed",
          aggregateType: "company_subscription",
          aggregateId: companyId,
          metadata: {
            stripeInvoiceId: invoice.id,
            stripeEventId: event.id,
            previousStripeStatus: before.stripeStatus,
            newStripeStatus: nextStatus,
          },
        });
      return { replay: false as const, companyId };
    }
    return { replay: false as const, ignored: "unsupported" as const };
  });
}

/** Retry-safe worker boundary; callers may invoke repeatedly after membership commits. */
export async function syncCompanySeatQuantity(companyId: string) {
  const [billing] = await getDb()
    .select()
    .from(companySubscription)
    .where(eq(companySubscription.companyId, companyId))
    .limit(1);
  if (
    !billing ||
    !["pending", "syncing"].includes(billing.seatSyncStatus) ||
    billing.stripeStatus !== "active" ||
    !billing.stripeSubscriptionId
  )
    return { skipped: true as const };
  const desired = stripeExtraUserQuantity(
    await countActiveCompanyMemberships(companyId),
  );
  try {
    let itemId = billing.stripeExtraItemId;
    if (itemId) {
      await getStripeClient().subscriptionItems.update(
        itemId,
        { quantity: desired, proration_behavior: "create_prorations" },
        {
          idempotencyKey: seatSyncIdempotencyKey(
            companyId,
            billing.seatSyncGeneration,
            desired,
            false,
          ),
        },
      );
    } else if (desired > 0) {
      const item = await getStripeClient().subscriptionItems.create(
        {
          subscription: billing.stripeSubscriptionId,
          price: required("STRIPE_PRICE_EXTRA_USER_MONTHLY"),
          quantity: desired,
          proration_behavior: "create_prorations",
        },
        {
          idempotencyKey: seatSyncIdempotencyKey(
            companyId,
            billing.seatSyncGeneration,
            desired,
            true,
          ),
        },
      );
      itemId = item.id;
    }
    await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(companySubscription)
        .set({
          stripeExtraItemId: itemId,
          lastSyncedSeatQuantity: desired,
          seatSyncStatus: "synced",
          seatSyncAttempts: 0,
          seatSyncLastError: null,
          seatSyncUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(companySubscription.companyId, companyId),
            eq(
              companySubscription.seatSyncUpdatedAt,
              billing.seatSyncUpdatedAt!,
            ),
          ),
        )
        .returning({ companyId: companySubscription.companyId });
      if (updated.length)
        await tx
          .insert(auditLog)
          .values({
            actorCompanyId: companyId,
            action: "stripe.seat_quantity_changed",
            aggregateType: "company_subscription",
            aggregateId: companyId,
            metadata: {
              previousQuantity: billing.lastSyncedSeatQuantity,
              newQuantity: desired,
              stripeSubscriptionId: billing.stripeSubscriptionId,
            },
          });
    });
    return { skipped: false as const, quantity: desired };
  } catch (error) {
    const safeName =
      error instanceof Error ? error.name.slice(0, 160) : "StripeError";
    await getDb()
      .update(companySubscription)
      .set({
        seatSyncStatus: "failed",
        seatSyncAttempts: billing.seatSyncAttempts + 1,
        seatSyncLastError: safeName,
        seatSyncUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companySubscription.companyId, companyId),
          eq(companySubscription.seatSyncUpdatedAt, billing.seatSyncUpdatedAt!),
        ),
      );
    throw error;
  }
}

export async function syncPendingSeatQuantities(limit = 25) {
  const staleBefore = new Date(Date.now() - 10 * 60_000);
  const claimable = or(
    inArray(companySubscription.seatSyncStatus, ["pending", "failed"]),
    and(
      eq(companySubscription.seatSyncStatus, "syncing"),
      lt(companySubscription.seatSyncUpdatedAt, staleBefore),
    ),
  );
  const activeClaimable = and(
    eq(companySubscription.stripeStatus, "active"),
    claimable,
  );
  const rows = await getDb()
    .select({ companyId: companySubscription.companyId })
    .from(companySubscription)
    .where(activeClaimable)
    .limit(Math.min(Math.max(limit, 1), 100));
  for (const row of rows) {
    const claimed = await getDb()
      .update(companySubscription)
      .set({ seatSyncStatus: "syncing", seatSyncUpdatedAt: new Date() })
      .where(
        and(eq(companySubscription.companyId, row.companyId), activeClaimable),
      )
      .returning({ companyId: companySubscription.companyId });
    if (!claimed.length) continue;
    try {
      await syncCompanySeatQuantity(row.companyId);
    } catch {
      /* retained as failed for the next retry */
    }
  }
  return { processed: rows.length };
}
