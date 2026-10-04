import { and, asc, desc, eq, max, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { dealerCounterpartyLabel, normalizeChatBody } from "@/domain/chat";
import { getDb } from "@/server/db";
import { auditLog, chatMessage, chatThread, company, match, user, vehicleListing } from "@/server/db/schema";
import { AccessError } from "@/server/security";

const seller = alias(company, "chat_seller");
const buyer = alias(company, "chat_buyer");

type ThreadRow = {
  id: string;
  listingId: string;
  sellerCompanyId: string;
  buyerCompanyId: string;
  anonymousNumber: number;
  sellerName: string;
  buyerName: string;
  vehicleModel: string | null;
  registrationNumber: string | null;
  matchedBuyerCompanyId: string | null;
  updatedAt: Date;
};

export type DealerChatThreadDto = {
  id: string;
  listingId: string;
  listingLabel: string;
  counterpartyLabel: string;
  identityRevealed: boolean;
  viewerIsSeller: boolean;
  updatedAt: Date;
};

export type DealerChatMessageDto = {
  id: string;
  body: string;
  fromViewerCompany: boolean;
  createdAt: Date;
};

const threadSelection = {
  id: chatThread.id,
  listingId: chatThread.listingId,
  sellerCompanyId: chatThread.sellerCompanyId,
  buyerCompanyId: chatThread.buyerCompanyId,
  anonymousNumber: chatThread.anonymousNumber,
  sellerName: seller.legalName,
  buyerName: buyer.legalName,
  vehicleModel: vehicleListing.vehicleModel,
  registrationNumber: vehicleListing.registrationNumber,
  matchedBuyerCompanyId: match.buyerCompanyId,
  updatedAt: chatThread.updatedAt,
} as const;

function listingLabel(row: Pick<ThreadRow, "vehicleModel" | "registrationNumber">) {
  return row.vehicleModel ?? row.registrationNumber ?? "Bilannons";
}

function identityRevealed(row: ThreadRow) {
  return row.matchedBuyerCompanyId === row.buyerCompanyId;
}

function dealerThread(row: ThreadRow, viewerCompanyId: string): DealerChatThreadDto {
  const revealed = identityRevealed(row);
  return {
    id: row.id,
    listingId: row.listingId,
    listingLabel: listingLabel(row),
    counterpartyLabel: dealerCounterpartyLabel({
      viewerCompanyId,
      sellerCompanyId: row.sellerCompanyId,
      buyerCompanyId: row.buyerCompanyId,
      sellerName: row.sellerName,
      buyerName: row.buyerName,
      anonymousNumber: row.anonymousNumber,
      identityRevealed: revealed,
    }),
    identityRevealed: revealed,
    viewerIsSeller: viewerCompanyId === row.sellerCompanyId,
    updatedAt: row.updatedAt,
  };
}

function baseThreadQuery() {
  return getDb().select(threadSelection).from(chatThread)
    .innerJoin(vehicleListing, eq(vehicleListing.id, chatThread.listingId))
    .innerJoin(seller, eq(seller.id, chatThread.sellerCompanyId))
    .innerJoin(buyer, eq(buyer.id, chatThread.buyerCompanyId))
    .leftJoin(match, eq(match.listingId, chatThread.listingId));
}

export async function listDealerChatThreads(companyId: string): Promise<DealerChatThreadDto[]> {
  const rows = await baseThreadQuery().where(or(
    eq(chatThread.sellerCompanyId, companyId),
    eq(chatThread.buyerCompanyId, companyId),
  )).orderBy(desc(chatThread.updatedAt));
  return (rows as ThreadRow[]).map((row) => dealerThread(row, companyId));
}

async function getParticipantThread(companyId: string, threadId: string): Promise<ThreadRow> {
  const [row] = await baseThreadQuery().where(and(
    eq(chatThread.id, threadId),
    or(eq(chatThread.sellerCompanyId, companyId), eq(chatThread.buyerCompanyId, companyId)),
  )).limit(1);
  if (!row) throw new AccessError(404, "CHAT_THREAD_NOT_FOUND");
  return row as ThreadRow;
}

export async function getDealerChatThread(companyId: string, threadId: string) {
  const row = await getParticipantThread(companyId, threadId);
  const messages = await getDb().select({
    id: chatMessage.id,
    body: chatMessage.body,
    senderCompanyId: chatMessage.senderCompanyId,
    createdAt: chatMessage.createdAt,
  }).from(chatMessage).where(eq(chatMessage.threadId, row.id)).orderBy(asc(chatMessage.createdAt), asc(chatMessage.id));
  return {
    thread: dealerThread(row, companyId),
    messages: messages.map((message): DealerChatMessageDto => ({
      id: message.id,
      body: message.body,
      fromViewerCompany: message.senderCompanyId === companyId,
      createdAt: message.createdAt,
    })),
  };
}

export async function createOrGetChatThread(input: {
  listingId: string;
  buyerCompanyId: string;
  actorUserId: string;
}) {
  const threadId = await getDb().transaction(async (tx) => {
    const [listing] = await tx.select({
      id: vehicleListing.id,
      sellerCompanyId: vehicleListing.sellerCompanyId,
      status: vehicleListing.status,
    }).from(vehicleListing).where(eq(vehicleListing.id, input.listingId)).for("update");
    if (!listing || listing.status !== "active") throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
    if (listing.sellerCompanyId === input.buyerCompanyId) throw new AccessError(409, "CHAT_SELF_CONVERSATION");
    const [existing] = await tx.select({ id: chatThread.id }).from(chatThread).where(and(
      eq(chatThread.listingId, listing.id),
      eq(chatThread.buyerCompanyId, input.buyerCompanyId),
    )).limit(1);
    if (existing) return existing.id;
    const [aliasRow] = await tx.select({ value: max(chatThread.anonymousNumber) }).from(chatThread)
      .where(eq(chatThread.listingId, listing.id));
    const [created] = await tx.insert(chatThread).values({
      listingId: listing.id,
      sellerCompanyId: listing.sellerCompanyId,
      buyerCompanyId: input.buyerCompanyId,
      anonymousNumber: (aliasRow.value ?? 0) + 1,
    }).returning({ id: chatThread.id });
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.buyerCompanyId,
      action: "chat_thread.created",
      aggregateType: "chat_thread",
      aggregateId: created.id,
      metadata: { listingId: listing.id },
    });
    return created.id;
  });
  return getDealerChatThread(input.buyerCompanyId, threadId);
}

export async function sendChatMessage(input: {
  companyId: string;
  actorUserId: string;
  threadId: string;
  body: string;
}) {
  let body: string;
  try { body = normalizeChatBody(input.body); }
  catch { throw new AccessError(400, "INVALID_CHAT_MESSAGE"); }
  await getParticipantThread(input.companyId, input.threadId);
  await getDb().transaction(async (tx) => {
    const [created] = await tx.insert(chatMessage).values({
      threadId: input.threadId,
      senderCompanyId: input.companyId,
      senderUserId: input.actorUserId,
      body,
    }).returning({ id: chatMessage.id });
    await tx.update(chatThread).set({ updatedAt: new Date() }).where(eq(chatThread.id, input.threadId));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "chat_message.sent",
      aggregateType: "chat_thread",
      aggregateId: input.threadId,
      metadata: { messageId: created.id },
    });
  });
  return getDealerChatThread(input.companyId, input.threadId);
}

export type PlatformChatThreadDto = {
  id: string;
  listingId: string;
  listingLabel: string;
  sellerCompanyName: string;
  buyerCompanyName: string;
  identityRevealed: boolean;
  updatedAt: Date;
};

function platformThread(row: ThreadRow): PlatformChatThreadDto {
  return {
    id: row.id,
    listingId: row.listingId,
    listingLabel: listingLabel(row),
    sellerCompanyName: row.sellerName,
    buyerCompanyName: row.buyerName,
    identityRevealed: identityRevealed(row),
    updatedAt: row.updatedAt,
  };
}

export async function listPlatformChatThreads(): Promise<PlatformChatThreadDto[]> {
  const rows = await baseThreadQuery().orderBy(desc(chatThread.updatedAt));
  return (rows as ThreadRow[]).map(platformThread);
}

export async function getPlatformChatThread(threadId: string) {
  const [row] = await baseThreadQuery().where(eq(chatThread.id, threadId)).limit(1);
  if (!row) throw new AccessError(404, "CHAT_THREAD_NOT_FOUND");
  const messages = await getDb().select({
    id: chatMessage.id,
    body: chatMessage.body,
    senderCompanyName: company.legalName,
    senderUserName: user.name,
    senderUserEmail: user.email,
    createdAt: chatMessage.createdAt,
  }).from(chatMessage)
    .innerJoin(company, eq(company.id, chatMessage.senderCompanyId))
    .innerJoin(user, eq(user.id, chatMessage.senderUserId))
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.createdAt), asc(chatMessage.id));
  return { thread: platformThread(row as ThreadRow), messages };
}
