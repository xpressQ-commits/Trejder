import { and, asc, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/server/db";
import {
  auditLog,
  bid,
  company,
  match,
  user,
  vehicleImage,
  vehicleListing,
} from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { getImageStorage } from "@/server/storage/images";
import { confirmDealParty } from "@/domain/deal";

const seller = alias(company, "deal_seller");
const buyer = alias(company, "deal_buyer");
const sellerContact = alias(user, "deal_seller_contact");
const buyerContact = alias(user, "deal_buyer_contact");

const dealSelection = {
  id: match.id,
  listingId: match.listingId,
  acceptedBidId: match.acceptedBidId,
  amountOre: match.vehicleAmountOre,
  acceptedAt: match.acceptedAt,
  status: match.status,
  sellerCompletedAt: match.sellerCompletedAt,
  buyerCompletedAt: match.buyerCompletedAt,
  completedAt: match.completedAt,
  sellerCompanyId: match.sellerCompanyId,
  buyerCompanyId: match.buyerCompanyId,
  sellerName: seller.legalName,
  sellerEmail: seller.contactEmail,
  sellerPhone: seller.contactPhone,
  buyerName: buyer.legalName,
  buyerEmail: buyer.contactEmail,
  buyerPhone: buyer.contactPhone,
  sellerContactName: sellerContact.name,
  buyerContactName: buyerContact.name,
  vehicleModel: vehicleListing.vehicleModel,
  registrationNumber: vehicleListing.registrationNumber,
  modelYear: vehicleListing.modelYear,
  mileageKm: vehicleListing.mileageKm,
} as const;

function baseDealQuery() {
  return getDb()
    .select(dealSelection)
    .from(match)
    .innerJoin(vehicleListing, eq(vehicleListing.id, match.listingId))
    .innerJoin(seller, eq(seller.id, match.sellerCompanyId))
    .innerJoin(buyer, eq(buyer.id, match.buyerCompanyId))
    .innerJoin(bid, eq(bid.id, match.acceptedBidId))
    .innerJoin(sellerContact, eq(sellerContact.id, match.acceptedByUserId))
    .innerJoin(buyerContact, eq(buyerContact.id, bid.placedByUserId));
}

type DealRow = Awaited<ReturnType<typeof baseDealQuery>>[number];

function toDeal(row: DealRow, companyId: string) {
  const viewerIsSeller = row.sellerCompanyId === companyId;
  return {
    id: row.id,
    listingId: row.listingId,
    acceptedBidId: row.acceptedBidId,
    amountOre: row.amountOre,
    acceptedAt: row.acceptedAt,
    status: row.status,
    completedAt: row.completedAt,
    viewerIsSeller,
    viewerCompletedAt: viewerIsSeller
      ? row.sellerCompletedAt
      : row.buyerCompletedAt,
    counterpartyCompletedAt: viewerIsSeller
      ? row.buyerCompletedAt
      : row.sellerCompletedAt,
    listingLabel: row.vehicleModel ?? row.registrationNumber ?? "Bilannons",
    modelYear: row.modelYear,
    mileageMil: row.mileageKm / 10,
    imageUrl: `/api/deals/${row.id}/images/1`,
    counterparty: viewerIsSeller
      ? {
          name: row.buyerName,
          contactName: row.buyerContactName,
          email: row.buyerEmail,
          phone: row.buyerPhone,
        }
      : {
          name: row.sellerName,
          contactName: row.sellerContactName,
          email: row.sellerEmail,
          phone: row.sellerPhone,
        },
  };
}

export async function listCompanyDeals(companyId: string) {
  const rows = await baseDealQuery()
    .where(
      or(
        eq(match.sellerCompanyId, companyId),
        eq(match.buyerCompanyId, companyId),
      ),
    )
    .orderBy(desc(match.acceptedAt));
  return rows.map((row) => toDeal(row, companyId));
}

export async function getCompanyDeal(companyId: string, dealId: string) {
  const [row] = await baseDealQuery()
    .where(
      and(
        eq(match.id, dealId),
        or(
          eq(match.sellerCompanyId, companyId),
          eq(match.buyerCompanyId, companyId),
        ),
      ),
    )
    .limit(1);
  if (!row) throw new AccessError(404, "DEAL_NOT_FOUND");
  return toDeal(row, companyId);
}

export async function findCompanyDealByListing(
  companyId: string,
  listingId: string,
) {
  const [row] = await baseDealQuery()
    .where(
      and(
        eq(match.listingId, listingId),
        or(
          eq(match.sellerCompanyId, companyId),
          eq(match.buyerCompanyId, companyId),
        ),
      ),
    )
    .limit(1);
  return row ? toDeal(row, companyId) : null;
}

export async function confirmDealCompletion(input: {
  companyId: string;
  actorUserId: string;
  dealId: string;
}) {
  return getDb().transaction(async (tx) => {
    const [deal] = await tx
      .select()
      .from(match)
      .where(eq(match.id, input.dealId))
      .for("update");
    if (
      !deal ||
      (deal.sellerCompanyId !== input.companyId &&
        deal.buyerCompanyId !== input.companyId)
    )
      throw new AccessError(404, "DEAL_NOT_FOUND");
    if (deal.status === "completed") return deal;
    const now = new Date();
    const viewerIsSeller = deal.sellerCompanyId === input.companyId;
    const completion = confirmDealParty({
      viewerIsSeller,
      sellerCompletedAt: deal.sellerCompletedAt,
      buyerCompletedAt: deal.buyerCompletedAt,
      now,
    });
    const [updated] = await tx
      .update(match)
      .set({
        ...completion,
      })
      .where(eq(match.id, deal.id))
      .returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action:
        completion.status === "completed"
          ? "deal.completed"
          : "deal.completion_confirmed",
      aggregateType: "match",
      aggregateId: deal.id,
    });
    return updated;
  });
}

export async function readDealImage(input: {
  companyId: string;
  dealId: string;
  position: number;
}) {
  const [image] = await getDb()
    .select({
      objectKey: vehicleImage.objectKey,
      mimeType: vehicleImage.mimeType,
    })
    .from(vehicleImage)
    .innerJoin(match, eq(match.listingId, vehicleImage.listingId))
    .where(
      and(
        eq(match.id, input.dealId),
        or(
          eq(match.sellerCompanyId, input.companyId),
          eq(match.buyerCompanyId, input.companyId),
        ),
        eq(vehicleImage.position, input.position),
      ),
    )
    .orderBy(asc(vehicleImage.position))
    .limit(1);
  if (!image) throw new AccessError(404, "IMAGE_NOT_FOUND");
  return {
    bytes: await getImageStorage().read(image.objectKey),
    mimeType: image.mimeType,
  };
}
