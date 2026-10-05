import { and, asc, eq, max } from "drizzle-orm";
import { containsContactInformation } from "@/domain/contact-content";
import { getDb } from "@/server/db";
import {
  auditLog,
  companyMembership,
  listingParticipantAlias,
  listingQuestion,
  notification,
  vehicleListing,
} from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { notificationUrl, sendPushToUsers } from "@/server/push-notifications";

const label = (number: number) =>
  `Handlare ${String.fromCharCode(64 + Math.min(number, 26))}`;
function body(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 1000)
    throw new AccessError(400, "INVALID_QUESTION_TEXT");
  if (containsContactInformation(normalized))
    throw new AccessError(400, "CONTACT_INFORMATION_NOT_ALLOWED");
  return normalized;
}

export async function listListingQuestions(listingId: string) {
  const rows = await getDb()
    .select({
      id: listingQuestion.id,
      body: listingQuestion.body,
      answerBody: listingQuestion.answerBody,
      createdAt: listingQuestion.createdAt,
      answeredAt: listingQuestion.answeredAt,
      anonymousNumber: listingParticipantAlias.anonymousNumber,
    })
    .from(listingQuestion)
    .innerJoin(
      listingParticipantAlias,
      and(
        eq(listingParticipantAlias.listingId, listingQuestion.listingId),
        eq(listingParticipantAlias.companyId, listingQuestion.authorCompanyId),
      ),
    )
    .where(
      and(
        eq(listingQuestion.listingId, listingId),
        eq(listingQuestion.status, "published"),
      ),
    )
    .orderBy(asc(listingQuestion.createdAt));
  return rows.map(({ anonymousNumber, ...row }) => ({
    ...row,
    authorLabel: label(anonymousNumber),
    answerAuthorLabel: row.answerBody ? "Säljaren" : null,
  }));
}

export async function askListingQuestion(input: {
  listingId: string;
  authorCompanyId: string;
  actorUserId: string;
  body: string;
}) {
  const questionBody = body(input.body);
  let pushRecipients: string[] = [];
  const result = await getDb().transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(vehicleListing)
      .where(eq(vehicleListing.id, input.listingId))
      .for("update");
    if (
      !listing ||
      listing.status !== "active" ||
      !listing.expiresAt ||
      listing.expiresAt <= new Date()
    )
      throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
    if (listing.sellerCompanyId === input.authorCompanyId)
      throw new AccessError(409, "SELF_QUESTION_NOT_ALLOWED");
    let [participant] = await tx
      .select()
      .from(listingParticipantAlias)
      .where(
        and(
          eq(listingParticipantAlias.listingId, listing.id),
          eq(listingParticipantAlias.companyId, input.authorCompanyId),
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
          companyId: input.authorCompanyId,
          anonymousNumber: (highest.value ?? 0) + 1,
        })
        .returning();
    }
    const [created] = await tx
      .insert(listingQuestion)
      .values({
        listingId: listing.id,
        authorCompanyId: input.authorCompanyId,
        authorUserId: input.actorUserId,
        body: questionBody,
      })
      .returning();
    const recipients = await tx
      .select({ userId: companyMembership.userId })
      .from(companyMembership)
      .where(
        and(
          eq(companyMembership.companyId, listing.sellerCompanyId),
          eq(companyMembership.status, "active"),
        ),
      );
    pushRecipients = recipients.map(({ userId }) => userId);
    if (recipients.length)
      await tx
        .insert(notification)
        .values(
          recipients.map(({ userId }) => ({
            recipientUserId: userId,
            type: "question.received",
            body: `Ny fråga från ${label(participant.anonymousNumber)}`,
            resourceType: "listing",
            resourceId: listing.id,
          })),
        );
    await tx
      .insert(auditLog)
      .values({
        actorUserId: input.actorUserId,
        actorCompanyId: input.authorCompanyId,
        action: "listing_question.created",
        aggregateType: "listing_question",
        aggregateId: created.id,
      });
    return created;
  });
  await sendPushToUsers(pushRecipients, {
    title: "Ny fråga på Trejder",
    body: "Du har fått en ny fråga.",
    url: notificationUrl({
      type: "question.received",
      resourceType: "listing",
      resourceId: input.listingId,
    }),
    tag: `question-${input.listingId}`,
  });
  return result;
}

export async function answerListingQuestion(input: {
  listingId: string;
  questionId: string;
  sellerCompanyId: string;
  actorUserId: string;
  body: string;
}) {
  const answerBody = body(input.body);
  let pushRecipients: string[] = [];
  const result = await getDb().transaction(async (tx) => {
    const [question] = await tx
      .select({
        id: listingQuestion.id,
        authorCompanyId: listingQuestion.authorCompanyId,
        sellerCompanyId: vehicleListing.sellerCompanyId,
      })
      .from(listingQuestion)
      .innerJoin(
        vehicleListing,
        eq(vehicleListing.id, listingQuestion.listingId),
      )
      .where(
        and(
          eq(listingQuestion.id, input.questionId),
          eq(listingQuestion.listingId, input.listingId),
          eq(vehicleListing.sellerCompanyId, input.sellerCompanyId),
        ),
      )
      .for("update");
    if (!question) throw new AccessError(404, "QUESTION_NOT_FOUND");
    const [updated] = await tx
      .update(listingQuestion)
      .set({
        answerBody,
        answeredByUserId: input.actorUserId,
        answeredAt: new Date(),
      })
      .where(eq(listingQuestion.id, question.id))
      .returning();
    const recipients = await tx
      .select({ userId: companyMembership.userId })
      .from(companyMembership)
      .where(
        and(
          eq(companyMembership.companyId, question.authorCompanyId),
          eq(companyMembership.status, "active"),
        ),
      );
    pushRecipients = recipients.map(({ userId }) => userId);
    if (recipients.length)
      await tx
        .insert(notification)
        .values(
          recipients.map(({ userId }) => ({
            recipientUserId: userId,
            type: "question.answered",
            body: "Säljaren har svarat på din fråga",
            resourceType: "listing",
            resourceId: input.listingId,
          })),
        );
    await tx
      .insert(auditLog)
      .values({
        actorUserId: input.actorUserId,
        actorCompanyId: input.sellerCompanyId,
        action: "listing_question.answered",
        aggregateType: "listing_question",
        aggregateId: question.id,
      });
    return updated;
  });
  await sendPushToUsers(pushRecipients, {
    title: "Svar på Trejder",
    body: "Säljaren har svarat på din fråga.",
    url: notificationUrl({
      type: "question.answered",
      resourceType: "listing",
      resourceId: input.listingId,
    }),
    tag: `question-${input.listingId}`,
  });
  return result;
}
