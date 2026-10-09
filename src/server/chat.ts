import { and, asc, count, desc, eq, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { dealerCounterpartyLabel, normalizeChatBody } from "@/domain/chat";
import { containsContactInformation } from "@/domain/contact-content";
import { canAccessAcceptedDealChat } from "@/domain/chat-access";
import { getDb } from "@/server/db";
import {
  auditLog,
  bid,
  chatMessage,
  chatThread,
  company,
  companyMembership,
  match,
  notification,
  user,
  vehicleListing,
} from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { notificationUrl, sendPushToUsers } from "@/server/push-notifications";

const seller = alias(company, "chat_seller");
const buyer = alias(company, "chat_buyer");

type ThreadRow = {
  id: string;
  matchId: string;
  bidId: string | null;
  bidStatus:
    | "active"
    | "withdrawn"
    | "accepted"
    | "rejected"
    | "lost"
    | "expired"
    | null;
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
  matchId: string;
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
  matchId: match.id,
  bidId: chatThread.bidId,
  bidStatus: bid.status,
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

function listingLabel(
  row: Pick<ThreadRow, "vehicleModel" | "registrationNumber">,
) {
  return row.vehicleModel ?? row.registrationNumber ?? "Bilannons";
}

function identityRevealed(row: ThreadRow) {
  return row.matchedBuyerCompanyId === row.buyerCompanyId;
}

function dealerThread(
  row: ThreadRow,
  viewerCompanyId: string,
): DealerChatThreadDto {
  const revealed = identityRevealed(row);
  return {
    id: row.id,
    matchId: row.matchId,
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
  return getDb()
    .select(threadSelection)
    .from(chatThread)
    .innerJoin(vehicleListing, eq(vehicleListing.id, chatThread.listingId))
    .innerJoin(seller, eq(seller.id, chatThread.sellerCompanyId))
    .innerJoin(buyer, eq(buyer.id, chatThread.buyerCompanyId))
    .leftJoin(bid, eq(bid.id, chatThread.bidId))
    .innerJoin(
      match,
      and(
        eq(match.listingId, chatThread.listingId),
        eq(match.acceptedBidId, chatThread.bidId),
        eq(match.sellerCompanyId, chatThread.sellerCompanyId),
        eq(match.buyerCompanyId, chatThread.buyerCompanyId),
      ),
    );
}

export async function listDealerChatThreads(
  companyId: string,
): Promise<DealerChatThreadDto[]> {
  const rows = await baseThreadQuery()
    .where(
      or(
        eq(chatThread.sellerCompanyId, companyId),
        eq(chatThread.buyerCompanyId, companyId),
      ),
    )
    .orderBy(desc(chatThread.updatedAt));
  return (rows as ThreadRow[]).map((row) => dealerThread(row, companyId));
}

async function getParticipantThread(
  companyId: string,
  threadId: string,
): Promise<ThreadRow> {
  const [row] = await baseThreadQuery()
    .where(
      and(
        eq(chatThread.id, threadId),
        or(
          eq(chatThread.sellerCompanyId, companyId),
          eq(chatThread.buyerCompanyId, companyId),
        ),
      ),
    )
    .limit(1);
  if (!row) throw new AccessError(404, "CHAT_THREAD_NOT_FOUND");
  return row as ThreadRow;
}

export async function getDealerChatThread(companyId: string, threadId: string) {
  const row = await getParticipantThread(companyId, threadId);
  await getDb()
    .update(chatMessage)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(chatMessage.threadId, row.id),
        ne(chatMessage.senderCompanyId, companyId),
        isNull(chatMessage.readAt),
      ),
    );
  const messages = await getDb()
    .select({
      id: chatMessage.id,
      body: chatMessage.body,
      senderCompanyId: chatMessage.senderCompanyId,
      createdAt: chatMessage.createdAt,
    })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, row.id))
    .orderBy(asc(chatMessage.createdAt), asc(chatMessage.id));
  return {
    thread: dealerThread(row, companyId),
    unreadCount: await countUnreadChatMessages(companyId),
    messages: messages.map((message): DealerChatMessageDto => ({
      id: message.id,
      body: message.body,
      fromViewerCompany: message.senderCompanyId === companyId,
      createdAt: message.createdAt,
    })),
  };
}

export async function createOrGetChatThread(input: {
  bidId: string;
  actorCompanyId: string;
  actorUserId: string;
}) {
  const threadId = await getDb().transaction(async (tx) => {
    const [placedBid] = await tx
      .select()
      .from(bid)
      .where(eq(bid.id, input.bidId))
      .for("update");
    if (!placedBid) throw new AccessError(404, "BID_NOT_FOUND");
    const [listing] = await tx
      .select({
        id: vehicleListing.id,
        sellerCompanyId: vehicleListing.sellerCompanyId,
        status: vehicleListing.status,
      })
      .from(vehicleListing)
      .where(eq(vehicleListing.id, placedBid.listingId))
      .for("update");
    if (!listing) throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
    if (
      input.actorCompanyId !== placedBid.bidderCompanyId &&
      input.actorCompanyId !== listing.sellerCompanyId
    )
      throw new AccessError(404, "BID_NOT_FOUND");
    const [acceptedDeal] = await tx
      .select({
        acceptedBidId: match.acceptedBidId,
        sellerCompanyId: match.sellerCompanyId,
        buyerCompanyId: match.buyerCompanyId,
      })
      .from(match)
      .where(
        and(
          eq(match.listingId, listing.id),
          eq(match.acceptedBidId, placedBid.id),
          eq(match.sellerCompanyId, listing.sellerCompanyId),
          eq(match.buyerCompanyId, placedBid.bidderCompanyId),
        ),
      )
      .limit(1);
    if (
      placedBid.status !== "accepted" ||
      listing.status !== "matched" ||
      !canAccessAcceptedDealChat({
        companyId: input.actorCompanyId,
        bidId: placedBid.id,
        deal: acceptedDeal ?? null,
      })
    ) {
      throw new AccessError(403, "CHAT_REQUIRES_ACCEPTED_BID");
    }
    const [existing] = await tx
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.bidId, placedBid.id)))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await tx
      .insert(chatThread)
      .values({
        listingId: listing.id,
        bidId: placedBid.id,
        sellerCompanyId: listing.sellerCompanyId,
        buyerCompanyId: placedBid.bidderCompanyId,
        anonymousNumber: placedBid.anonymousNumber,
      })
      .returning({ id: chatThread.id });
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.actorCompanyId,
      action: "chat_thread.created",
      aggregateType: "chat_thread",
      aggregateId: created.id,
      metadata: { listingId: listing.id, bidId: placedBid.id },
    });
    return created.id;
  });
  return getDealerChatThread(input.actorCompanyId, threadId);
}

export async function sendChatMessage(input: {
  companyId: string;
  actorUserId: string;
  threadId: string;
  body: string;
}) {
  let body: string;
  try {
    body = normalizeChatBody(input.body);
  } catch {
    throw new AccessError(400, "INVALID_CHAT_MESSAGE");
  }
  const participantThread = await getParticipantThread(
    input.companyId,
    input.threadId,
  );
  if (
    !participantThread.bidId ||
    participantThread.bidStatus !== "accepted" ||
    !identityRevealed(participantThread)
  ) {
    throw new AccessError(403, "CHAT_REQUIRES_ACCEPTED_BID");
  }
  if (containsContactInformation(body) && !identityRevealed(participantThread))
    throw new AccessError(400, "CONTACT_INFORMATION_NOT_ALLOWED");
  let pushRecipients: string[] = [];
  await getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(chatMessage)
      .values({
        threadId: input.threadId,
        senderCompanyId: input.companyId,
        senderUserId: input.actorUserId,
        body,
      })
      .returning({ id: chatMessage.id });
    await tx
      .update(chatThread)
      .set({ updatedAt: new Date() })
      .where(eq(chatThread.id, input.threadId));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "chat_message.sent",
      aggregateType: "chat_thread",
      aggregateId: input.threadId,
      metadata: { messageId: created.id },
    });
    const recipientCompanyId =
      input.companyId === participantThread.sellerCompanyId
        ? participantThread.buyerCompanyId
        : participantThread.sellerCompanyId;
    const recipients = await tx
      .select({ userId: companyMembership.userId })
      .from(companyMembership)
      .where(
        and(
          eq(companyMembership.companyId, recipientCompanyId),
          eq(companyMembership.status, "active"),
        ),
      );
    pushRecipients = recipients.map(({ userId }) => userId);
    if (recipients.length)
      await tx.insert(notification).values(
        recipients.map(({ userId }) => ({
          recipientUserId: userId,
          type: "chat.message",
          body: "Du har fått ett nytt meddelande",
          resourceType: "match",
          resourceId: participantThread.matchId,
        })),
      );
  });
  await sendPushToUsers(pushRecipients, {
    title: "Nytt meddelande på Trejder",
    body: "Du har fått ett nytt meddelande.",
    url: notificationUrl({
      type: "chat.message",
      resourceType: "match",
      resourceId: participantThread.matchId,
    }),
    tag: `chat-${participantThread.matchId}`,
  });
  return getDealerChatThread(input.companyId, input.threadId);
}

export async function countUnreadChatMessages(
  companyId: string,
): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(chatMessage)
    .innerJoin(chatThread, eq(chatThread.id, chatMessage.threadId))
    .innerJoin(
      match,
      and(
        eq(match.listingId, chatThread.listingId),
        eq(match.acceptedBidId, chatThread.bidId),
        eq(match.sellerCompanyId, chatThread.sellerCompanyId),
        eq(match.buyerCompanyId, chatThread.buyerCompanyId),
      ),
    )
    .where(
      and(
        or(
          eq(chatThread.sellerCompanyId, companyId),
          eq(chatThread.buyerCompanyId, companyId),
        ),
        ne(chatMessage.senderCompanyId, companyId),
        isNull(chatMessage.readAt),
      ),
    );
  return Number(row?.value ?? 0);
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

export async function listPlatformChatThreads(): Promise<
  PlatformChatThreadDto[]
> {
  const rows = await baseThreadQuery().orderBy(desc(chatThread.updatedAt));
  return (rows as ThreadRow[]).map(platformThread);
}

export async function getPlatformChatThread(threadId: string) {
  const [row] = await baseThreadQuery()
    .where(eq(chatThread.id, threadId))
    .limit(1);
  if (!row) throw new AccessError(404, "CHAT_THREAD_NOT_FOUND");
  const messages = await getDb()
    .select({
      id: chatMessage.id,
      body: chatMessage.body,
      senderCompanyName: company.legalName,
      senderUserName: user.name,
      senderUserEmail: user.email,
      createdAt: chatMessage.createdAt,
    })
    .from(chatMessage)
    .innerJoin(company, eq(company.id, chatMessage.senderCompanyId))
    .innerJoin(user, eq(user.id, chatMessage.senderUserId))
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.createdAt), asc(chatMessage.id));
  return { thread: platformThread(row as ThreadRow), messages };
}
