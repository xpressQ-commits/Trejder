import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Role } from "@/domain/authorization";
import {
  canEditActiveListingFields,
  MAX_LISTING_COMMENT_LENGTH,
  normalizeIdentifier,
  normalizeModelYear,
  normalizeMileageMil,
  type VehicleIdentifier,
} from "@/domain/vehicle-listing";
import { getDb } from "@/server/db";
import { auditLog, vehicleImage, vehicleListing } from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { redactVehicleImage, type PlateRedactionStatus } from "@/server/vehicles/plate-redaction";
import {
  createPrivateObjectKey,
  getImageStorage,
  validateImage,
} from "@/server/storage/images";

type ListingStatus = "draft" | "active" | "matched" | "withdrawn";

export type OwnListingDto = {
  id: string;
  identifier: VehicleIdentifier;
  mileageMil: number;
  modelYear: number | null;
  shortComment: string;
  deductibleVat: boolean;
  status: ListingStatus;
  createdAt: Date;
  publishedAt: Date | null;
  images: Array<{
    id: string;
    position: number;
    mimeType: string;
    byteSize: number;
    plateRedactionStatus: PlateRedactionStatus;
    plateConfidence: number | null;
    url: string;
  }>;
};

export type ListingInput = {
  identifier: Extract<VehicleIdentifier, { kind: "model" }>;
  modelYear: number;
  mileageMil: number;
  shortComment: string;
  deductibleVat: boolean;
};

function normalizeComment(value: string): string {
  const comment = value.trim();
  if (!comment || comment.length > MAX_LISTING_COMMENT_LENGTH) {
    throw new AccessError(400, "INVALID_COMMENT");
  }
  return comment;
}

function normalizedListingValues(input: ListingInput) {
  let identifier: Extract<VehicleIdentifier, { kind: "model" }>;
  let mileageKm: number;
  let modelYear: number;
  try {
    const normalized = normalizeIdentifier(input.identifier);
    if (normalized.kind !== "model") throw new Error("INVALID_IDENTIFIER");
    identifier = normalized;
    mileageKm = normalizeMileageMil(input.mileageMil);
    modelYear = normalizeModelYear(input.modelYear);
  } catch {
    throw new AccessError(400, "INVALID_LISTING_INPUT");
  }
  return {
    inputKind: "model" as const,
    registrationNumber: null,
    vehicleModel: identifier.value,
    modelYear,
    mileageKm,
    shortComment: normalizeComment(input.shortComment),
    deductibleVat: input.deductibleVat,
  } as const;
}

function rowIdentifier(row: { inputKind: "registration" | "model"; registrationNumber: string | null; vehicleModel: string | null }): VehicleIdentifier {
  if (row.inputKind === "registration" && row.registrationNumber) {
    return { kind: "registration", value: row.registrationNumber };
  }
  if (row.inputKind === "model" && row.vehicleModel) {
    return { kind: "model", value: row.vehicleModel };
  }
  throw new Error("Vehicle listing identifier invariant violated");
}

function toDto(
  row: typeof vehicleListing.$inferSelect,
  images: Array<typeof vehicleImage.$inferSelect>,
): OwnListingDto {
  if (!Number.isSafeInteger(row.mileageKm) || row.mileageKm % 10 !== 0) {
    throw new Error("Vehicle listing mileage invariant violated");
  }
  return {
    id: row.id,
    identifier: rowIdentifier(row),
    mileageMil: row.mileageKm / 10,
    modelYear: row.modelYear,
    shortComment: row.shortComment,
    deductibleVat: row.deductibleVat,
    status: row.status,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    images: images.map((image) => ({
      id: image.id,
      position: image.position,
      mimeType: image.mimeType,
      byteSize: image.byteSize,
      plateRedactionStatus: image.plateRedactionStatus,
      plateConfidence: image.plateConfidence === null ? null : image.plateConfidence / 1000,
      url: `/api/company/listings/${row.id}/images/${image.position}`,
    })),
  };
}

export async function listOwnListings(
  companyId: string,
  status?: "draft" | "active" | "withdrawn",
): Promise<OwnListingDto[]> {
  const db = getDb();
  const listings = await db.select().from(vehicleListing)
    .where(status
      ? and(eq(vehicleListing.sellerCompanyId, companyId), eq(vehicleListing.status, status))
      : eq(vehicleListing.sellerCompanyId, companyId))
    .orderBy(desc(vehicleListing.createdAt));
  if (listings.length === 0) return [];
  const images = await db.select().from(vehicleImage)
    .where(inArray(vehicleImage.listingId, listings.map((listing) => listing.id)))
    .orderBy(asc(vehicleImage.position));
  return listings.map((listing) => toDto(
    listing,
    images.filter((image) => image.listingId === listing.id),
  ));
}

export async function getOwnListing(companyId: string, listingId: string): Promise<OwnListingDto> {
  const db = getDb();
  const [listing] = await db.select().from(vehicleListing).where(and(
    eq(vehicleListing.id, listingId),
    eq(vehicleListing.sellerCompanyId, companyId),
  )).limit(1);
  if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
  const images = await db.select().from(vehicleImage)
    .where(eq(vehicleImage.listingId, listing.id))
    .orderBy(asc(vehicleImage.position));
  return toDto(listing, images);
}

export async function createDraft(input: {
  companyId: string;
  actorUserId: string;
  values: ListingInput;
}): Promise<OwnListingDto> {
  const values = normalizedListingValues(input.values);
  const [created] = await getDb().transaction(async (tx) => {
    const rows = await tx.insert(vehicleListing).values({
      sellerCompanyId: input.companyId,
      createdByUserId: input.actorUserId,
      ...values,
      status: "draft",
    }).returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "vehicle_listing.created",
      aggregateType: "vehicle_listing",
      aggregateId: rows[0].id,
      metadata: { inputKind: values.inputKind },
    });
    return rows;
  });
  return toDto(created, []);
}

export async function updateOwnListing(input: {
  companyId: string;
  listingId: string;
  actorUserId: string;
  values: Partial<ListingInput>;
}): Promise<OwnListingDto> {
  await getDb().transaction(async (tx) => {
    const [listing] = await tx.select().from(vehicleListing).where(and(
      eq(vehicleListing.id, input.listingId),
      eq(vehicleListing.sellerCompanyId, input.companyId),
    )).for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (listing.status === "withdrawn" || listing.status === "matched") {
      throw new AccessError(409, "LISTING_NOT_EDITABLE");
    }

    const changedKeys = Object.keys(input.values);
    if (changedKeys.length === 0) throw new AccessError(400, "NO_LISTING_CHANGES");
    if (listing.status === "active" && !canEditActiveListingFields(changedKeys)) {
      throw new AccessError(409, "ACTIVE_LISTING_FIELDS_LOCKED");
    }

    const update: Partial<typeof vehicleListing.$inferInsert> = {};
    if (input.values.identifier) {
      let identifier: Extract<VehicleIdentifier, { kind: "model" }>;
      try {
        const normalized = normalizeIdentifier(input.values.identifier);
        if (normalized.kind !== "model") throw new Error("INVALID_IDENTIFIER");
        identifier = normalized;
      }
      catch { throw new AccessError(400, "INVALID_IDENTIFIER"); }
      update.inputKind = "model";
      update.registrationNumber = null;
      update.vehicleModel = identifier.value;
    }
    if (input.values.mileageMil !== undefined) {
      try { update.mileageKm = normalizeMileageMil(input.values.mileageMil); }
      catch { throw new AccessError(400, "INVALID_MILEAGE"); }
    }
    if (input.values.modelYear !== undefined) {
      try { update.modelYear = normalizeModelYear(input.values.modelYear); }
      catch { throw new AccessError(400, "INVALID_MODEL_YEAR"); }
    }
    if (input.values.shortComment !== undefined) update.shortComment = normalizeComment(input.values.shortComment);
    if (input.values.deductibleVat !== undefined) update.deductibleVat = input.values.deductibleVat;

    await tx.update(vehicleListing).set({ ...update, updatedAt: new Date() }).where(and(
      eq(vehicleListing.id, listing.id),
      eq(vehicleListing.sellerCompanyId, input.companyId),
    ));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "vehicle_listing.updated",
      aggregateType: "vehicle_listing",
      aggregateId: listing.id,
      metadata: { fields: changedKeys },
    });
  });
  return getOwnListing(input.companyId, input.listingId);
}

export async function publishListing(input: {
  companyId: string;
  listingId: string;
  actorUserId: string;
}): Promise<OwnListingDto> {
  await getDb().transaction(async (tx) => {
    const [listing] = await tx.select().from(vehicleListing).where(and(
      eq(vehicleListing.id, input.listingId),
      eq(vehicleListing.sellerCompanyId, input.companyId),
    )).for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (listing.status === "active") return;
    if (listing.status !== "draft") throw new AccessError(409, "INVALID_LISTING_TRANSITION");
    if (listing.modelYear === null) throw new AccessError(409, "MODEL_YEAR_REQUIRED");
    const images = await tx.select({ status: vehicleImage.plateRedactionStatus }).from(vehicleImage)
      .where(eq(vehicleImage.listingId, listing.id));
    if (images.length < 1 || images.length > 5) throw new AccessError(409, "IMAGE_COUNT_REQUIRED");
    if (isPlateRedactionRequired() && images.some((image) => !["NO_PLATE_DETECTED", "PLATE_REDACTED"].includes(image.status))) {
      throw new AccessError(409, "IMAGE_REDACTION_INCOMPLETE");
    }
    await tx.update(vehicleListing).set({ status: "active", publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(vehicleListing.id, listing.id), eq(vehicleListing.status, "draft")));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "vehicle_listing.published",
      aggregateType: "vehicle_listing",
      aggregateId: listing.id,
    });
  });
  return getOwnListing(input.companyId, input.listingId);
}

export async function withdrawListing(input: {
  companyId: string;
  listingId: string;
  actorUserId: string;
}): Promise<OwnListingDto> {
  await getDb().transaction(async (tx) => {
    const [listing] = await tx.select().from(vehicleListing).where(and(
      eq(vehicleListing.id, input.listingId),
      eq(vehicleListing.sellerCompanyId, input.companyId),
    )).for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (listing.status === "withdrawn") return;
    if (listing.status !== "draft" && listing.status !== "active") {
      throw new AccessError(409, "INVALID_LISTING_TRANSITION");
    }
    await tx.update(vehicleListing).set({ status: "withdrawn", updatedAt: new Date() })
      .where(and(eq(vehicleListing.id, listing.id), eq(vehicleListing.sellerCompanyId, input.companyId)));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "vehicle_listing.withdrawn",
      aggregateType: "vehicle_listing",
      aggregateId: listing.id,
    });
  });
  return getOwnListing(input.companyId, input.listingId);
}

export async function putListingImage(input: {
  companyId: string;
  listingId: string;
  actorUserId: string;
  position: number;
  claimedMime: string;
  bytes: Uint8Array;
}): Promise<OwnListingDto> {
  if (!Number.isInteger(input.position) || input.position < 1 || input.position > 5) {
    throw new AccessError(400, "INVALID_IMAGE_POSITION");
  }
  const source = validateImage(input.bytes, input.claimedMime);
  const current = await getOwnListing(input.companyId, input.listingId);
  if (current.status === "withdrawn" || current.status === "matched") {
    throw new AccessError(409, "LISTING_NOT_EDITABLE");
  }
  if (current.status === "active" && !current.images.some((image) => image.position === input.position)) {
    throw new AccessError(409, "ACTIVE_LISTING_REPLACE_ONLY");
  }

  const [sameImage] = await getDb().select({ id: vehicleImage.id }).from(vehicleImage).where(and(
    eq(vehicleImage.listingId, input.listingId),
    eq(vehicleImage.position, input.position),
    eq(vehicleImage.sourceChecksumSha256, source.checksumSha256),
    inArray(vehicleImage.plateRedactionStatus, ["NO_PLATE_DETECTED", "PLATE_REDACTED"]),
  )).limit(1);
  if (sameImage) return current;

  const redaction = await redactVehicleImage(input.bytes, source.mimeType);
  const validated = validateImage(redaction.bytes, redaction.mimeType);

  const objectKey = createPrivateObjectKey(validated.mimeType);
  const storage = getImageStorage();
  await storage.put(objectKey, redaction.bytes, validated.mimeType);
  let previousKey: string | undefined;
  try {
    await getDb().transaction(async (tx) => {
      const [listing] = await tx.select().from(vehicleListing).where(and(
        eq(vehicleListing.id, input.listingId),
        eq(vehicleListing.sellerCompanyId, input.companyId),
      )).for("update");
      if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
      if (listing.status === "withdrawn" || listing.status === "matched") {
        throw new AccessError(409, "LISTING_NOT_EDITABLE");
      }
      const [existing] = await tx.select().from(vehicleImage).where(and(
        eq(vehicleImage.listingId, listing.id),
        eq(vehicleImage.position, input.position),
      )).for("update");
      if (listing.status === "active" && !existing) {
        throw new AccessError(409, "ACTIVE_LISTING_REPLACE_ONLY");
      }
      previousKey = existing?.objectKey;
      if (existing) {
        await tx.update(vehicleImage).set({
          objectKey,
          mimeType: validated.mimeType,
          byteSize: validated.byteSize,
          checksumSha256: validated.checksumSha256,
          sourceChecksumSha256: source.checksumSha256,
          plateRedactionStatus: redaction.status,
          plateConfidence: redaction.confidence === null ? null : Math.round(redaction.confidence * 1000),
          plateProcessedAt: new Date(),
          plateProcessingError: redaction.error,
          createdAt: new Date(),
        }).where(eq(vehicleImage.id, existing.id));
      } else {
        await tx.insert(vehicleImage).values({
          listingId: listing.id,
          position: input.position,
          objectKey,
          mimeType: validated.mimeType,
          byteSize: validated.byteSize,
          checksumSha256: validated.checksumSha256,
          sourceChecksumSha256: source.checksumSha256,
          plateRedactionStatus: redaction.status,
          plateConfidence: redaction.confidence === null ? null : Math.round(redaction.confidence * 1000),
          plateProcessedAt: new Date(),
          plateProcessingError: redaction.error,
        });
      }
      await tx.insert(auditLog).values({
        actorUserId: input.actorUserId,
        actorCompanyId: input.companyId,
        action: existing ? "vehicle_image.replaced" : "vehicle_image.added",
        aggregateType: "vehicle_listing",
        aggregateId: listing.id,
        metadata: {
          position: input.position,
          mimeType: validated.mimeType,
          byteSize: validated.byteSize,
          plateRedactionStatus: redaction.status,
        },
      });
    });
  } catch (error) {
    await storage.delete(objectKey).catch(() => undefined);
    throw error;
  }
  if (previousKey) {
    await storage.delete(previousKey).catch((error: unknown) => {
      console.error("Failed to delete replaced private image", { listingId: input.listingId, error });
    });
  }
  return getOwnListing(input.companyId, input.listingId);
}

export async function removeListingImage(input: {
  companyId: string;
  listingId: string;
  actorUserId: string;
  position: number;
}): Promise<OwnListingDto> {
  let objectKey: string | undefined;
  await getDb().transaction(async (tx) => {
    const [listing] = await tx.select().from(vehicleListing).where(and(
      eq(vehicleListing.id, input.listingId),
      eq(vehicleListing.sellerCompanyId, input.companyId),
    )).for("update");
    if (!listing) throw new AccessError(404, "LISTING_NOT_FOUND");
    if (listing.status !== "draft") throw new AccessError(409, "DRAFT_IMAGES_REMOVABLE_ONLY");
    const [image] = await tx.select().from(vehicleImage).where(and(
      eq(vehicleImage.listingId, listing.id),
      eq(vehicleImage.position, input.position),
    )).for("update");
    if (!image) throw new AccessError(404, "IMAGE_NOT_FOUND");
    objectKey = image.objectKey;
    await tx.delete(vehicleImage).where(eq(vehicleImage.id, image.id));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      actorCompanyId: input.companyId,
      action: "vehicle_image.removed",
      aggregateType: "vehicle_listing",
      aggregateId: listing.id,
      metadata: { position: input.position },
    });
  });
  if (objectKey) {
    await getImageStorage().delete(objectKey).catch((error: unknown) => {
      console.error("Failed to delete removed private image", { listingId: input.listingId, error });
    });
  }
  return getOwnListing(input.companyId, input.listingId);
}

export async function readOwnListingImage(input: {
  companyId: string;
  listingId: string;
  position: number;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const [image] = await getDb().select({
    objectKey: vehicleImage.objectKey,
    mimeType: vehicleImage.mimeType,
  }).from(vehicleImage)
    .innerJoin(vehicleListing, eq(vehicleListing.id, vehicleImage.listingId))
    .where(and(
      eq(vehicleImage.listingId, input.listingId),
      eq(vehicleImage.position, input.position),
      eq(vehicleListing.sellerCompanyId, input.companyId),
    )).limit(1);
  if (!image) throw new AccessError(404, "IMAGE_NOT_FOUND");
  return { bytes: await getImageStorage().read(image.objectKey), mimeType: image.mimeType };
}

export function canMutateListings(role: Role): boolean {
  return role === "admin" || role === "trader";
}

export function isPlateRedactionRequired(): boolean {
  return process.env.PLATE_REDACTION_REQUIRED === "true"
    || Boolean(process.env.PLATE_RECOGNIZER_API_TOKEN?.trim());
}
