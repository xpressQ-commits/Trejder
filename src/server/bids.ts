import { and, asc, count, desc, eq, max, ne } from "drizzle-orm";
import { currentDealerMatchFees } from "@/domain/commercial-terms";
import { getDb } from "@/server/db";
import { auditLog, bid, companyMembership, listingParticipantAlias, match, notification, vehicleListing } from "@/server/db/schema";
import { AccessError } from "@/server/security";

function dealerLabel(number: number) { return `Handlare ${String.fromCharCode(64 + Math.min(number, 26))}`; }

async function notifyCompanyMembers(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], companyId: string, values: { type: string; body: string; resourceType: string; resourceId: string }) {
  const recipients = await tx.select({ userId: companyMembership.userId }).from(companyMembership).where(and(eq(companyMembership.companyId, companyId), eq(companyMembership.status, "active")));
  if (recipients.length) await tx.insert(notification).values(recipients.map(({ userId }) => ({ recipientUserId: userId, ...values })));
}

export async function placeBid(input: { listingId: string; bidderCompanyId: string; actorUserId: string; amountOre: number }) {
  if (!Number.isSafeInteger(input.amountOre) || input.amountOre <= 0) throw new AccessError(400, "INVALID_BID_AMOUNT");
  return getDb().transaction(async (tx) => {
    const [listing] = await tx.select({ id: vehicleListing.id, sellerCompanyId: vehicleListing.sellerCompanyId, status: vehicleListing.status, expiresAt: vehicleListing.expiresAt }).from(vehicleListing).where(eq(vehicleListing.id, input.listingId)).for("update");
    if (!listing || listing.status !== "active" || !listing.expiresAt || listing.expiresAt <= new Date()) throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
    if (listing.sellerCompanyId === input.bidderCompanyId) throw new AccessError(409, "SELF_BID_NOT_ALLOWED");
    let [participant] = await tx.select().from(listingParticipantAlias).where(and(eq(listingParticipantAlias.listingId, listing.id), eq(listingParticipantAlias.companyId, input.bidderCompanyId))).limit(1);
    if (!participant) {
      const [highest] = await tx.select({ value: max(listingParticipantAlias.anonymousNumber) }).from(listingParticipantAlias).where(eq(listingParticipantAlias.listingId, listing.id));
      [participant] = await tx.insert(listingParticipantAlias).values({ listingId: listing.id, companyId: input.bidderCompanyId, anonymousNumber: (highest.value ?? 0) + 1 }).returning();
    }
    const [existing] = await tx.select().from(bid).where(and(eq(bid.listingId, listing.id), eq(bid.bidderCompanyId, input.bidderCompanyId))).for("update");
    const [saved] = existing
      ? await tx.update(bid).set({ amountOre: input.amountOre, status: "active", placedByUserId: input.actorUserId, version: existing.version + 1 }).where(eq(bid.id, existing.id)).returning()
      : await tx.insert(bid).values({ listingId: listing.id, listingSellerCompanyId: listing.sellerCompanyId, bidderCompanyId: input.bidderCompanyId, placedByUserId: input.actorUserId, anonymousNumber: participant.anonymousNumber, amountOre: input.amountOre }).returning();
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.bidderCompanyId, action: existing ? "bid.updated" : "bid.placed", aggregateType: "bid", aggregateId: saved.id, metadata: { listingId: listing.id, amountOre: input.amountOre } });
    await notifyCompanyMembers(tx, listing.sellerCompanyId, { type: "bid.received", body: `Nytt bud från ${dealerLabel(saved.anonymousNumber)}`, resourceType: "listing", resourceId: listing.id });
    return { id: saved.id, amountOre: saved.amountOre, status: saved.status, updatedAt: saved.updatedAt };
  });
}

export async function getOwnBid(listingId: string, bidderCompanyId: string) {
  const [row] = await getDb().select({ id: bid.id, amountOre: bid.amountOre, status: bid.status, updatedAt: bid.updatedAt }).from(bid).where(and(eq(bid.listingId, listingId), eq(bid.bidderCompanyId, bidderCompanyId))).limit(1);
  return row ?? null;
}

export async function listSellerBids(listingId: string, sellerCompanyId: string) {
  const listing = await getDb().query.vehicleListing.findFirst({ where: and(eq(vehicleListing.id, listingId), eq(vehicleListing.sellerCompanyId, sellerCompanyId)), columns: { id: true } });
  if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
  const rows = await getDb().select({ id: bid.id, amountOre: bid.amountOre, status: bid.status, anonymousNumber: bid.anonymousNumber, createdAt: bid.createdAt, updatedAt: bid.updatedAt }).from(bid).where(eq(bid.listingId, listingId)).orderBy(desc(bid.amountOre), asc(bid.createdAt));
  return rows.map(({ anonymousNumber, ...row }) => ({ ...row, bidderLabel: dealerLabel(anonymousNumber) }));
}

export async function countSellerActiveBids(sellerCompanyId: string) {
  const [result] = await getDb().select({ value: count() }).from(bid).innerJoin(vehicleListing, eq(vehicleListing.id, bid.listingId)).where(and(eq(vehicleListing.sellerCompanyId, sellerCompanyId), eq(bid.status, "active")));
  return result.value;
}

export async function acceptBid(input: { listingId: string; bidId: string; sellerCompanyId: string; actorUserId: string }) {
  return getDb().transaction(async (tx) => {
    const [listing] = await tx.select().from(vehicleListing).where(and(eq(vehicleListing.id, input.listingId), eq(vehicleListing.sellerCompanyId, input.sellerCompanyId))).for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (listing.status !== "active") throw new AccessError(409, "LISTING_NOT_ACTIVE");
    const [accepted] = await tx.select().from(bid).where(and(eq(bid.id, input.bidId), eq(bid.listingId, listing.id), eq(bid.listingSellerCompanyId, input.sellerCompanyId))).for("update");
    if (!accepted || accepted.status !== "active") throw new AccessError(409, "BID_NOT_ACTIVE");
    const [alreadyMatched] = await tx.select({ id: match.id }).from(match).where(eq(match.listingId, listing.id)).limit(1);
    if (alreadyMatched) throw new AccessError(409, "LISTING_ALREADY_MATCHED");
    const fees = currentDealerMatchFees();
    const losingBids = await tx.select({ bidderCompanyId: bid.bidderCompanyId }).from(bid).where(and(eq(bid.listingId, listing.id), ne(bid.id, accepted.id), eq(bid.status, "active")));
    await tx.update(vehicleListing).set({ status: "matched", version: listing.version + 1 }).where(eq(vehicleListing.id, listing.id));
    await tx.update(bid).set({ status: "lost" }).where(and(eq(bid.listingId, listing.id), ne(bid.id, accepted.id), eq(bid.status, "active")));
    await tx.update(bid).set({ status: "accepted", version: accepted.version + 1 }).where(eq(bid.id, accepted.id));
    const [created] = await tx.insert(match).values({ listingId: listing.id, acceptedBidId: accepted.id, sellerCompanyId: input.sellerCompanyId, buyerCompanyId: accepted.bidderCompanyId, acceptedByUserId: input.actorUserId, vehicleAmountOre: accepted.amountOre, ...fees }).returning();
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.sellerCompanyId, action: "bid.accepted", aggregateType: "match", aggregateId: created.id, metadata: { bidId: accepted.id, listingId: listing.id } });
    await notifyCompanyMembers(tx, accepted.bidderCompanyId, { type: "bid.accepted", body: "Ditt bud har accepterats", resourceType: "match", resourceId: created.id });
    for (const losing of losingBids) await notifyCompanyMembers(tx, losing.bidderCompanyId, { type: "bid.lost", body: "Annonsen har sålts till en annan budgivare", resourceType: "listing", resourceId: listing.id });
    return created;
  });
}
