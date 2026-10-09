import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  max,
  ne,
  or,
} from "drizzle-orm";
import { currentDealerMatchFees } from "@/domain/commercial-terms";
import { isBillingExempt } from "@/domain/company-policy";
import { getDb } from "@/server/db";
import {
  auditLog,
  bid,
  chatThread,
  company,
  companyMembership,
  listingParticipantAlias,
  match,
  notification,
  vehicleListing,
} from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { notificationUrl, sendPushToUsers } from "@/server/push-notifications";

function dealerLabel(number: number) {
  return `Handlare ${String.fromCharCode(64 + Math.min(number, 26))}`;
}

export function toPublicBidActivity(
  rows: Array<{ anonymousNumber: number; createdAt: Date }>,
) {
  const uniqueByBidder = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!uniqueByBidder.has(row.anonymousNumber))
      uniqueByBidder.set(row.anonymousNumber, row);
  }
  const unique = [...uniqueByBidder.values()];
  return {
    bidderCount: unique.length,
    activity: unique.map((row) => ({
      anonymousLabel: dealerLabel(row.anonymousNumber),
      createdAt: row.createdAt,
    })),
  };
}

async function notifyCompanyMembers(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  companyId: string,
  values: {
    type: string;
    body: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const recipients = await tx
    .select({ userId: companyMembership.userId })
    .from(companyMembership)
    .where(
      and(
        eq(companyMembership.companyId, companyId),
        eq(companyMembership.status, "active"),
      ),
    );
  if (recipients.length)
    await tx.insert(notification).values(
      recipients.map(({ userId }) => ({
        recipientUserId: userId,
        ...values,
      })),
    );
  return recipients.map(({ userId }) => userId);
}

export async function placeBid(input: {
  listingId: string;
  bidderCompanyId: string;
  actorUserId: string;
  amountOre: number;
}) {
  if (!Number.isSafeInteger(input.amountOre) || input.amountOre <= 0)
    throw new AccessError(400, "INVALID_BID_AMOUNT");
  let pushRecipients: string[] = [];
  const result = await getDb().transaction(async (tx) => {
    const [listing] = await tx
      .select({
        id: vehicleListing.id,
        sellerCompanyId: vehicleListing.sellerCompanyId,
        status: vehicleListing.status,
        expiresAt: vehicleListing.expiresAt,
        publicationRound: vehicleListing.publicationRound,
      })
      .from(vehicleListing)
      .where(eq(vehicleListing.id, input.listingId))
      .for("update");
    if (
      !listing ||
      listing.status !== "active" ||
      (listing.expiresAt !== null && listing.expiresAt <= new Date())
    )
      throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
    if (listing.sellerCompanyId === input.bidderCompanyId)
      throw new AccessError(409, "SELF_BID_NOT_ALLOWED");
    let [participant] = await tx
      .select()
      .from(listingParticipantAlias)
      .where(
        and(
          eq(listingParticipantAlias.listingId, listing.id),
          eq(listingParticipantAlias.companyId, input.bidderCompanyId),
        ),
      )
      .limit(1);
    if (!participant) {
      const [highest] = await tx
        .select({ value: max(listingParticipantAlias.anonymousNumber) })
        .from(listingParticipantAlias)
        .where(eq(listingParticipantAlias.listingId, listing.id));
      [participant] = await tx
        .insert(listingParticipantAlias)
        .values({
          listingId: listing.id,
          companyId: input.bidderCompanyId,
          anonymousNumber: (highest.value ?? 0) + 1,
        })
        .returning();
    }
    const [existing] = await tx
      .select()
      .from(bid)
      .where(
        and(
          eq(bid.listingId, listing.id),
          eq(bid.bidderCompanyId, input.bidderCompanyId),
          eq(bid.publicationRound, listing.publicationRound),
        ),
      )
      .for("update");
    const [saved] = existing
      ? await tx
          .update(bid)
          .set({
            amountOre: input.amountOre,
            status: "active",
            placedByUserId: input.actorUserId,
            version: existing.version + 1,
          })
          .where(eq(bid.id, existing.id))
          .returning()
      : await tx
          .insert(bid)
          .values({
            listingId: listing.id,
            listingSellerCompanyId: listing.sellerCompanyId,
            bidderCompanyId: input.bidderCompanyId,
            placedByUserId: input.actorUserId,
            anonymousNumber: participant.anonymousNumber,
            publicationRound: listing.publicationRound,
            amountOre: input.amountOre,
          })
          .returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.bidderCompanyId,
      action: existing ? "bid.updated" : "bid.placed",
      aggregateType: "bid",
      aggregateId: saved.id,
      metadata: { listingId: listing.id, amountOre: input.amountOre },
    });
    pushRecipients = await notifyCompanyMembers(tx, listing.sellerCompanyId, {
      type: "bid.received",
      body: `Nytt bud från ${dealerLabel(saved.anonymousNumber)}`,
      resourceType: "listing",
      resourceId: listing.id,
    });
    return {
      id: saved.id,
      amountOre: saved.amountOre,
      status: saved.status,
      updatedAt: saved.updatedAt,
    };
  });
  await sendPushToUsers(pushRecipients, {
    title: "Nytt bud på Trejder",
    body: "Du har fått ett nytt bud.",
    url: notificationUrl({
      type: "bid.received",
      resourceType: "listing",
      resourceId: input.listingId,
    }),
    tag: `listing-${input.listingId}`,
  });
  return result;
}

export async function getOwnBid(listingId: string, bidderCompanyId: string) {
  const [row] = await getDb()
    .select({
      id: bid.id,
      amountOre: bid.amountOre,
      status: bid.status,
      updatedAt: bid.updatedAt,
    })
    .from(bid)
    .innerJoin(vehicleListing, eq(vehicleListing.id, bid.listingId))
    .where(
      and(
        eq(bid.listingId, listingId),
        eq(bid.bidderCompanyId, bidderCompanyId),
        eq(bid.publicationRound, vehicleListing.publicationRound),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listPublicBidActivity(listingId: string) {
  const [listing] = await getDb()
    .select({ publicationRound: vehicleListing.publicationRound })
    .from(vehicleListing)
    .where(
      and(
        eq(vehicleListing.id, listingId),
        eq(vehicleListing.status, "active"),
        or(
          isNull(vehicleListing.expiresAt),
          gt(vehicleListing.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  if (!listing) throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
  const rows = await getDb()
    .select({
      anonymousNumber: bid.anonymousNumber,
      createdAt: bid.createdAt,
    })
    .from(bid)
    .where(
      and(
        eq(bid.listingId, listingId),
        eq(bid.publicationRound, listing.publicationRound),
        eq(bid.status, "active"),
      ),
    )
    .orderBy(asc(bid.createdAt));
  return toPublicBidActivity(rows);
}

export async function listSellerBids(
  listingId: string,
  sellerCompanyId: string,
) {
  const listing = await getDb().query.vehicleListing.findFirst({
    where: and(
      eq(vehicleListing.id, listingId),
      eq(vehicleListing.sellerCompanyId, sellerCompanyId),
    ),
    columns: { id: true, publicationRound: true, status: true },
  });
  if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
  const selection = {
    id: bid.id,
    amountOre: bid.amountOre,
    status: bid.status,
    anonymousNumber: bid.anonymousNumber,
    createdAt: bid.createdAt,
    updatedAt: bid.updatedAt,
  } as const;
  const rows = await getDb()
    .select({
      ...selection,
    })
    .from(bid)
    .where(
      and(
        eq(bid.listingId, listingId),
        eq(bid.publicationRound, listing.publicationRound),
        eq(bid.status, "active"),
      ),
    )
    .orderBy(desc(bid.amountOre), asc(bid.createdAt))
    .limit(3);
  const [total] = await getDb()
    .select({ value: countDistinct(bid.bidderCompanyId) })
    .from(bid)
    .where(
      and(
        eq(bid.listingId, listingId),
        eq(bid.publicationRound, listing.publicationRound),
        eq(bid.status, "active"),
      ),
    );
  const [accepted] =
    listing.status === "matched"
      ? await getDb()
          .select({ ...selection })
          .from(bid)
          .where(
            and(
              eq(bid.listingId, listingId),
              eq(bid.publicationRound, listing.publicationRound),
              eq(bid.status, "accepted"),
            ),
          )
          .limit(1)
      : [];
  const toSellerDto = ({ anonymousNumber, ...row }: (typeof rows)[number]) => ({
    ...row,
    bidderLabel: dealerLabel(anonymousNumber),
  });
  return {
    bids: rows.map(toSellerDto),
    acceptedBid: accepted ? toSellerDto(accepted) : null,
    totalActiveBidders: Number(total?.value ?? 0),
  };
}

export async function countSellerActiveBids(sellerCompanyId: string) {
  const [result] = await getDb()
    .select({ value: count() })
    .from(bid)
    .innerJoin(vehicleListing, eq(vehicleListing.id, bid.listingId))
    .where(
      and(
        eq(vehicleListing.sellerCompanyId, sellerCompanyId),
        eq(bid.status, "active"),
        eq(vehicleListing.status, "active"),
        or(
          isNull(vehicleListing.expiresAt),
          gt(vehicleListing.expiresAt, new Date()),
        ),
      ),
    );
  return result.value;
}

export async function rejectBid(input: {
  listingId: string;
  bidId: string;
  sellerCompanyId: string;
  actorUserId: string;
}) {
  let pushRecipients: string[] = [];
  const rejected = await getDb().transaction(async (tx) => {
    const [listing] = await tx
      .select({
        id: vehicleListing.id,
        status: vehicleListing.status,
        expiresAt: vehicleListing.expiresAt,
        publicationRound: vehicleListing.publicationRound,
        vehicleModel: vehicleListing.vehicleModel,
        registrationNumber: vehicleListing.registrationNumber,
      })
      .from(vehicleListing)
      .where(
        and(
          eq(vehicleListing.id, input.listingId),
          eq(vehicleListing.sellerCompanyId, input.sellerCompanyId),
        ),
      )
      .for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (
      listing.status !== "active" ||
      (listing.expiresAt !== null && listing.expiresAt <= new Date())
    )
      throw new AccessError(409, "LISTING_NOT_ACTIVE");
    const [target] = await tx
      .select()
      .from(bid)
      .where(
        and(
          eq(bid.id, input.bidId),
          eq(bid.listingId, listing.id),
          eq(bid.listingSellerCompanyId, input.sellerCompanyId),
          eq(bid.publicationRound, listing.publicationRound),
        ),
      )
      .for("update");
    if (!target) throw new AccessError(404, "BID_NOT_FOUND");
    if (target.status !== "active")
      throw new AccessError(409, "BID_NOT_ACTIVE");
    const [saved] = await tx
      .update(bid)
      .set({
        status: "rejected",
        version: target.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(bid.id, target.id), eq(bid.status, "active")))
      .returning({ id: bid.id, status: bid.status });
    if (!saved) throw new AccessError(409, "BID_NOT_ACTIVE");
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.sellerCompanyId,
      action: "bid.rejected",
      aggregateType: "bid",
      aggregateId: target.id,
      metadata: {
        listingId: listing.id,
        bidderCompanyId: target.bidderCompanyId,
        amountOre: target.amountOre,
      },
    });
    const listingLabel =
      listing.vehicleModel ?? listing.registrationNumber ?? "bilannonsen";
    pushRecipients = await notifyCompanyMembers(tx, target.bidderCompanyId, {
      type: "bid.rejected",
      body: `Ditt bud på ${listingLabel} har avböjts.`,
      resourceType: "listing",
      resourceId: listing.id,
      metadata: {
        listingId: listing.id,
        bidId: target.id,
        amountOre: target.amountOre,
      },
    });
    return saved;
  });
  await sendPushToUsers(pushRecipients, {
    title: "Bud avböjt på Trejder",
    body: "Ditt bud har avböjts.",
    url: notificationUrl({
      type: "bid.rejected",
      resourceType: "listing",
      resourceId: input.listingId,
    }),
    tag: `bid-rejected-${input.bidId}`,
  });
  return rejected;
}

export async function acceptBid(input: {
  listingId: string;
  bidId: string;
  sellerCompanyId: string;
  actorUserId: string;
}) {
  const pushes: Array<{
    userIds: string[];
    body: string;
    resourceType: string;
    resourceId: string;
    type: string;
  }> = [];
  const result = await getDb().transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(vehicleListing)
      .where(
        and(
          eq(vehicleListing.id, input.listingId),
          eq(vehicleListing.sellerCompanyId, input.sellerCompanyId),
        ),
      )
      .for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (
      listing.status !== "active" ||
      (listing.expiresAt !== null && listing.expiresAt <= new Date())
    )
      throw new AccessError(409, "LISTING_NOT_ACTIVE");
    const [accepted] = await tx
      .select()
      .from(bid)
      .where(
        and(
          eq(bid.id, input.bidId),
          eq(bid.listingId, listing.id),
          eq(bid.listingSellerCompanyId, input.sellerCompanyId),
          eq(bid.publicationRound, listing.publicationRound),
        ),
      )
      .for("update");
    if (!accepted || accepted.status !== "active")
      throw new AccessError(409, "BID_NOT_ACTIVE");
    const [alreadyMatched] = await tx
      .select({ id: match.id })
      .from(match)
      .where(eq(match.listingId, listing.id))
      .limit(1);
    if (alreadyMatched) throw new AccessError(409, "LISTING_ALREADY_MATCHED");
    const parties = await tx
      .select({ id: company.id, isPlatformOwner: company.isPlatformOwner })
      .from(company)
      .where(
        inArray(company.id, [input.sellerCompanyId, accepted.bidderCompanyId]),
      );
    const fees = currentDealerMatchFees({
      sellerBillingExempt: isBillingExempt(
        parties.find((party) => party.id === input.sellerCompanyId) ?? {
          isPlatformOwner: false,
        },
      ),
      buyerBillingExempt: isBillingExempt(
        parties.find((party) => party.id === accepted.bidderCompanyId) ?? {
          isPlatformOwner: false,
        },
      ),
    });
    const losingBids = await tx
      .select({ bidderCompanyId: bid.bidderCompanyId })
      .from(bid)
      .where(
        and(
          eq(bid.listingId, listing.id),
          ne(bid.id, accepted.id),
          eq(bid.status, "active"),
          eq(bid.publicationRound, listing.publicationRound),
        ),
      );
    await tx
      .update(vehicleListing)
      .set({ status: "matched", version: listing.version + 1 })
      .where(eq(vehicleListing.id, listing.id));
    await tx
      .update(bid)
      .set({ status: "lost" })
      .where(
        and(
          eq(bid.listingId, listing.id),
          ne(bid.id, accepted.id),
          eq(bid.status, "active"),
          eq(bid.publicationRound, listing.publicationRound),
        ),
      );
    await tx
      .update(bid)
      .set({ status: "accepted", version: accepted.version + 1 })
      .where(eq(bid.id, accepted.id));
    const [created] = await tx
      .insert(match)
      .values({
        listingId: listing.id,
        acceptedBidId: accepted.id,
        sellerCompanyId: input.sellerCompanyId,
        buyerCompanyId: accepted.bidderCompanyId,
        acceptedByUserId: input.actorUserId,
        vehicleAmountOre: accepted.amountOre,
        ...fees,
      })
      .returning();
    await tx
      .insert(chatThread)
      .values({
        listingId: listing.id,
        bidId: accepted.id,
        sellerCompanyId: input.sellerCompanyId,
        buyerCompanyId: accepted.bidderCompanyId,
        anonymousNumber: accepted.anonymousNumber,
      })
      .onConflictDoNothing({ target: chatThread.bidId });
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.sellerCompanyId,
      action: "bid.accepted",
      aggregateType: "match",
      aggregateId: created.id,
      metadata: { bidId: accepted.id, listingId: listing.id },
    });
    const acceptedRecipients = await notifyCompanyMembers(
      tx,
      accepted.bidderCompanyId,
      {
        type: "bid.accepted",
        body: "Ditt bud har accepterats",
        resourceType: "match",
        resourceId: created.id,
      },
    );
    pushes.push({
      userIds: acceptedRecipients,
      body: "Ditt bud har accepterats.",
      type: "bid.accepted",
      resourceType: "match",
      resourceId: created.id,
    });
    for (const losing of losingBids) {
      const losingRecipients = await notifyCompanyMembers(
        tx,
        losing.bidderCompanyId,
        {
          type: "bid.lost",
          body: "Annonsen har sålts till en annan budgivare",
          resourceType: "listing",
          resourceId: listing.id,
        },
      );
      pushes.push({
        userIds: losingRecipients,
        body: "Annonsen såldes till en annan budgivare.",
        type: "bid.lost",
        resourceType: "listing",
        resourceId: listing.id,
      });
    }
    return created;
  });
  await Promise.all(
    pushes.map((push) =>
      sendPushToUsers(push.userIds, {
        title: "Buduppdatering på Trejder",
        body: push.body,
        url: notificationUrl(push),
        tag: `${push.type}-${push.resourceId}`,
      }),
    ),
  );
  return result;
}
