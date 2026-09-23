import { and, asc, count, eq } from "drizzle-orm";
import { canEditActiveListingFields, MAX_LISTING_COMMENT_LENGTH, normalizeIdentifier, normalizeMileageMil, type VehicleIdentifier } from "@/domain/vehicle-listing";
import { getDb } from "@/server/db";
import { auditLog, vehicleImage, vehicleListing } from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { createPrivateObjectKey, getImageStorage, validateImage } from "@/server/storage/images";

export type ListingInput = { identifier: VehicleIdentifier; mileageMil: number; shortComment: string; deductibleVat: boolean };

function fields(input: ListingInput) {
  const identifier = normalizeIdentifier(input.identifier);
  const shortComment = input.shortComment.trim();
  if (shortComment.length > MAX_LISTING_COMMENT_LENGTH) throw new AccessError(400, "INVALID_COMMENT");
  return {
    inputKind: identifier.kind,
    registrationNumber: identifier.kind === "registration" ? identifier.value : null,
    vehicleModel: identifier.kind === "model" ? identifier.value : null,
    mileageKm: normalizeMileageMil(input.mileageMil),
    shortComment,
    deductibleVat: input.deductibleVat,
  } as const;
}

function dto(row: typeof vehicleListing.$inferSelect, images: (typeof vehicleImage.$inferSelect)[]) {
  return {
    id: row.id,
    identifier: row.inputKind === "registration" ? { kind: "registration" as const, value: row.registrationNumber! } : { kind: "model" as const, value: row.vehicleModel! },
    mileageMil: row.mileageKm / 10,
    shortComment: row.shortComment,
    deductibleVat: row.deductibleVat,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    images: images.map((image) => ({ id: image.id, position: image.position, mimeType: image.mimeType, byteSize: image.byteSize })),
  };
}

export async function getOwnListing(companyId: string, listingId: string) {
  const row = await getDb().query.vehicleListing.findFirst({ where: and(eq(vehicleListing.id, listingId), eq(vehicleListing.sellerCompanyId, companyId)) });
  if (!row) throw new AccessError(404, "LISTING_NOT_FOUND");
  const images = await getDb().select().from(vehicleImage).where(eq(vehicleImage.listingId, row.id)).orderBy(asc(vehicleImage.position));
  return dto(row, images);
}

export async function listOwnListings(companyId: string) {
  const rows = await getDb().select().from(vehicleListing).where(eq(vehicleListing.sellerCompanyId, companyId)).orderBy(vehicleListing.createdAt);
  return Promise.all(rows.map(async (row) => dto(row, await getDb().select().from(vehicleImage).where(eq(vehicleImage.listingId, row.id)).orderBy(asc(vehicleImage.position)))));
}

export async function createDraft(input: ListingInput & { companyId: string; actorUserId: string }) {
  const [created] = await getDb().transaction(async (tx) => {
    const rows = await tx.insert(vehicleListing).values({ sellerCompanyId: input.companyId, createdByUserId: input.actorUserId, ...fields(input) }).returning();
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.companyId, action: "vehicle_listing.created", aggregateType: "vehicle_listing", aggregateId: rows[0].id });
    return rows;
  });
  return dto(created, []);
}

export async function updateOwnListing(input: Partial<ListingInput> & { listingId: string; companyId: string; actorUserId: string }) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(vehicleListing).where(and(eq(vehicleListing.id, input.listingId), eq(vehicleListing.sellerCompanyId, input.companyId))).for("update");
    if (!row) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (row.status !== "draft" && row.status !== "active") throw new AccessError(409, "LISTING_NOT_EDITABLE");
    const keys = Object.keys(input).filter((key) => !["listingId", "companyId", "actorUserId"].includes(key));
    if (row.status === "active" && !canEditActiveListingFields(keys)) throw new AccessError(409, "ACTIVE_FIELDS_LOCKED");
    let updates: Record<string, unknown> = {};
    if (row.status === "active") {
      const comment = input.shortComment?.trim();
      if (comment === undefined || comment.length > MAX_LISTING_COMMENT_LENGTH) throw new AccessError(400, "INVALID_COMMENT");
      updates = { shortComment: comment };
    } else {
      const complete: ListingInput = {
        identifier: input.identifier ?? (row.inputKind === "registration" ? { kind: "registration", value: row.registrationNumber! } : { kind: "model", value: row.vehicleModel! }),
        mileageMil: input.mileageMil ?? row.mileageKm / 10,
        shortComment: input.shortComment ?? row.shortComment,
        deductibleVat: input.deductibleVat ?? row.deductibleVat,
      };
      updates = fields(complete);
    }
    const [updated] = await tx.update(vehicleListing).set({ ...updates, version: row.version + 1, updatedAt: new Date() }).where(and(eq(vehicleListing.id, row.id), eq(vehicleListing.sellerCompanyId, input.companyId))).returning();
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.companyId, action: "vehicle_listing.updated", aggregateType: "vehicle_listing", aggregateId: row.id, metadata: { fields: keys } });
    const images = await tx.select().from(vehicleImage).where(eq(vehicleImage.listingId, row.id)).orderBy(asc(vehicleImage.position));
    return dto(updated, images);
  });
}

export async function publishOwnListing(input: { listingId: string; companyId: string; actorUserId: string }) {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(vehicleListing).where(and(eq(vehicleListing.id, input.listingId), eq(vehicleListing.sellerCompanyId, input.companyId))).for("update");
    if (!row) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (row.status === "active") return;
    if (row.status !== "draft") throw new AccessError(409, "INVALID_LISTING_TRANSITION");
    const [imageCount] = await tx.select({ value: count() }).from(vehicleImage).where(eq(vehicleImage.listingId, row.id));
    if (imageCount.value !== 3) throw new AccessError(409, "THREE_IMAGES_REQUIRED");
    await tx.update(vehicleListing).set({ status: "active", publishedAt: new Date(), version: row.version + 1, updatedAt: new Date() }).where(and(eq(vehicleListing.id, row.id), eq(vehicleListing.status, "draft")));
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.companyId, action: "vehicle_listing.published", aggregateType: "vehicle_listing", aggregateId: row.id });
  });
}

export async function withdrawOwnListing(input: { listingId: string; companyId: string; actorUserId: string }) {
  await getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(vehicleListing).where(and(eq(vehicleListing.id, input.listingId), eq(vehicleListing.sellerCompanyId, input.companyId))).for("update");
    if (!row) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (row.status === "withdrawn") return;
    if (row.status !== "draft" && row.status !== "active") throw new AccessError(409, "INVALID_LISTING_TRANSITION");
    await tx.update(vehicleListing).set({ status: "withdrawn", version: row.version + 1, updatedAt: new Date() }).where(eq(vehicleListing.id, row.id));
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.companyId, action: "vehicle_listing.withdrawn", aggregateType: "vehicle_listing", aggregateId: row.id });
  });
}

export async function putOwnListingImage(input: { listingId: string; companyId: string; actorUserId: string; position: number; bytes: Uint8Array; claimedMime: string }) {
  if (![1,2,3].includes(input.position)) throw new AccessError(400, "INVALID_IMAGE_POSITION");
  const metadata = validateImage(input.bytes, input.claimedMime);
  const key = createPrivateObjectKey(input.companyId, input.listingId, input.position, metadata.mimeType);
  const storage = getImageStorage();
  await storage.put(key, input.bytes, metadata.mimeType);
  let oldKey: string | undefined;
  try {
    await getDb().transaction(async (tx) => {
      const [listing] = await tx.select().from(vehicleListing).where(and(eq(vehicleListing.id, input.listingId), eq(vehicleListing.sellerCompanyId, input.companyId))).for("update");
      if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
      if (listing.status !== "draft" && listing.status !== "active") throw new AccessError(409, "LISTING_NOT_EDITABLE");
      const [old] = await tx.select().from(vehicleImage).where(and(eq(vehicleImage.listingId, listing.id), eq(vehicleImage.position, input.position))).for("update");
      oldKey = old?.objectKey;
      if (old) await tx.delete(vehicleImage).where(eq(vehicleImage.id, old.id));
      const [created] = await tx.insert(vehicleImage).values({ listingId: listing.id, position: input.position, objectKey: key, ...metadata }).returning({ id: vehicleImage.id });
      await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.companyId, action: old ? "vehicle_image.replaced" : "vehicle_image.added", aggregateType: "vehicle_listing", aggregateId: listing.id, metadata: { imageId: created.id, position: input.position } });
    });
  } catch (error) { await storage.delete(key).catch(() => undefined); throw error; }
  if (oldKey) await storage.delete(oldKey).catch(() => undefined);
}

export async function removeOwnListingImage(input: { listingId: string; companyId: string; actorUserId: string; position: number }) {
  let objectKey: string | undefined;
  await getDb().transaction(async (tx) => {
    const [listing] = await tx.select().from(vehicleListing).where(and(eq(vehicleListing.id, input.listingId), eq(vehicleListing.sellerCompanyId, input.companyId))).for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (listing.status !== "draft") throw new AccessError(409, "IMAGE_REMOVAL_REQUIRES_DRAFT");
    const [image] = await tx.select().from(vehicleImage).where(and(eq(vehicleImage.listingId, listing.id), eq(vehicleImage.position, input.position))).for("update");
    if (!image) throw new AccessError(404, "IMAGE_NOT_FOUND");
    objectKey = image.objectKey;
    await tx.delete(vehicleImage).where(eq(vehicleImage.id, image.id));
    await tx.insert(auditLog).values({ actorUserId: input.actorUserId, actorCompanyId: input.companyId, action: "vehicle_image.removed", aggregateType: "vehicle_listing", aggregateId: listing.id, metadata: { imageId: image.id, position: image.position } });
  });
  if (objectKey) await getImageStorage().delete(objectKey).catch(() => undefined);
}

export async function readOwnListingImage(input: { listingId: string; companyId: string; position: number }) {
  const [row] = await getDb().select({ objectKey: vehicleImage.objectKey, mimeType: vehicleImage.mimeType }).from(vehicleImage)
    .innerJoin(vehicleListing, and(eq(vehicleListing.id, vehicleImage.listingId), eq(vehicleListing.sellerCompanyId, input.companyId)))
    .where(and(eq(vehicleImage.listingId, input.listingId), eq(vehicleImage.position, input.position)));
  if (!row) throw new AccessError(404, "IMAGE_NOT_FOUND");
  const storage = getImageStorage();
  if (!storage.read) throw new AccessError(503 as never, "IMAGE_DELIVERY_NOT_CONFIGURED");
  return { bytes: await storage.read(row.objectKey), mimeType: row.mimeType };
}
