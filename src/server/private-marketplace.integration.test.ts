import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLog, bid, chatMessage, chatThread, company, companyMembership, listingParticipantAlias, listingQuestion, match, notification, user, vehicleListing } from "@/server/db/schema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(testDatabaseUrl));

integration("private customer marketplace invariants", () => {
  const sellerCompany = randomUUID(); const dealerA = randomUUID(); const dealerB = randomUUID();
  const sellerUser = randomUUID(); const dealerUserA = randomUUID(); const dealerUserB = randomUUID();
  const listingId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const { getDb } = await import("@/server/db"); const db = getDb();
    await db.insert(user).values([{ id: sellerUser, name: "Privat Säljare", email: `${sellerUser}@example.test`, emailVerified: true }, { id: dealerUserA, name: "Handlare A", email: `${dealerUserA}@example.test`, emailVerified: true }, { id: dealerUserB, name: "Handlare B", email: `${dealerUserB}@example.test`, emailVerified: true }]);
    await db.insert(company).values([{ id: sellerCompany, legalName: "Privat Säljare", organizationNumber: `P${randomUUID().slice(0, 12)}`, contactEmail: `${sellerUser}@example.test`, kind: "private" }, { id: dealerA, legalName: "Dealer A AB", organizationNumber: `A${randomUUID().slice(0, 12)}`, contactEmail: `${dealerUserA}@example.test` }, { id: dealerB, legalName: "Dealer B AB", organizationNumber: `B${randomUUID().slice(0, 12)}`, contactEmail: `${dealerUserB}@example.test` }]);
    await db.insert(companyMembership).values([{ companyId: sellerCompany, userId: sellerUser, role: "private_customer" }, { companyId: dealerA, userId: dealerUserA, role: "trader" }, { companyId: dealerB, userId: dealerUserB, role: "trader" }]);
    await db.insert(vehicleListing).values({ id: listingId, sellerCompanyId: sellerCompany, createdByUserId: sellerUser, inputKind: "model", vehicleModel: "Volvo XC60", modelYear: 2025, mileageKm: 1000, shortComment: "Testbil", deductibleVat: false, status: "active", publishedAt: new Date(), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  });

  afterAll(async () => {
    if (!testDatabaseUrl) return; const { getDb } = await import("@/server/db"); const db = getDb(); const companies = [sellerCompany, dealerA, dealerB];
    await db.delete(notification).where(inArray(notification.recipientUserId, [sellerUser, dealerUserA, dealerUserB]));
    await db.delete(chatMessage).where(inArray(chatMessage.senderCompanyId, companies)); await db.delete(chatThread).where(eq(chatThread.listingId, listingId));
    await db.delete(match).where(eq(match.listingId, listingId)); await db.delete(listingQuestion).where(eq(listingQuestion.listingId, listingId)); await db.delete(bid).where(eq(bid.listingId, listingId)); await db.delete(listingParticipantAlias).where(eq(listingParticipantAlias.listingId, listingId));
    await db.delete(auditLog).where(inArray(auditLog.actorCompanyId, companies)); await db.delete(vehicleListing).where(eq(vehicleListing.id, listingId)); await db.delete(companyMembership).where(inArray(companyMembership.companyId, companies)); await db.delete(company).where(inArray(company.id, companies)); await db.delete(user).where(inArray(user.id, [sellerUser, dealerUserA, dealerUserB]));
  });

  it("uses one stable listing alias for a dealer's question and bid", async () => {
    const { askListingQuestion } = await import("./questions"); const { placeBid } = await import("./bids"); const { getDb } = await import("@/server/db");
    await askListingQuestion({ listingId, authorCompanyId: dealerA, actorUserId: dealerUserA, body: "Är serviceboken komplett?" });
    const placed = await placeBid({ listingId, bidderCompanyId: dealerA, actorUserId: dealerUserA, amountOre: 20_000_000 });
    const [alias] = await getDb().select().from(listingParticipantAlias).where(and(eq(listingParticipantAlias.listingId, listingId), eq(listingParticipantAlias.companyId, dealerA)));
    const [placedRow] = await getDb().select().from(bid).where(eq(bid.id, placed.id)); expect(placedRow.anonymousNumber).toBe(alias.anonymousNumber);
  });

  it("requires a bid for chat and blocks contact details before acceptance", async () => {
    const { createOrGetChatThread, sendChatMessage } = await import("./chat");
    await expect(createOrGetChatThread({ bidId: randomUUID(), actorCompanyId: dealerB, actorUserId: dealerUserB })).rejects.toMatchObject({ code: "BID_NOT_FOUND" });
    const { placeBid } = await import("./bids"); const placed = await placeBid({ listingId, bidderCompanyId: dealerB, actorUserId: dealerUserB, amountOre: 19_000_000 });
    const created = await createOrGetChatThread({ bidId: placed.id, actorCompanyId: sellerCompany, actorUserId: sellerUser });
    await expect(sendChatMessage({ companyId: sellerCompany, actorUserId: sellerUser, threadId: created.thread.id, body: "Ring 070-123 45 67" })).rejects.toMatchObject({ code: "CONTACT_INFORMATION_NOT_ALLOWED" });
  });

  it("atomically accepts one bid, loses the others and reveals only the matched identities", async () => {
    const { acceptBid } = await import("./bids"); const { getDb } = await import("@/server/db");
    const bids = await getDb().select().from(bid).where(eq(bid.listingId, listingId)); const winning = bids.find((item) => item.bidderCompanyId === dealerA)!;
    await acceptBid({ listingId, bidId: winning.id, sellerCompanyId: sellerCompany, actorUserId: sellerUser });
    const rows = await getDb().select().from(bid).where(eq(bid.listingId, listingId)); expect(rows.filter((item) => item.status === "accepted")).toHaveLength(1); expect(rows.find((item) => item.bidderCompanyId === dealerB)?.status).toBe("lost");
    await expect(acceptBid({ listingId, bidId: rows.find((item) => item.bidderCompanyId === dealerB)!.id, sellerCompanyId: sellerCompany, actorUserId: sellerUser })).rejects.toMatchObject({ code: "LISTING_NOT_ACTIVE" });
  });
});
