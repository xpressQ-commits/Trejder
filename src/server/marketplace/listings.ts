import { Buffer } from "node:buffer";
import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { VehicleIdentifier } from "@/domain/vehicle-listing";
import { getDb } from "@/server/db";
import { vehicleImage, vehicleListing } from "@/server/db/schema";
import { AccessError } from "@/server/security";
import { getImageStorage } from "@/server/storage/images";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;

export type MarketplaceImageDto = { position: number; url: string };
export type MarketplaceListingSummaryDto = {
  id: string;
  identifier: VehicleIdentifier;
  mileageMil: number;
  modelYear: number | null;
  shortComment: string;
  deductibleVat: boolean;
  publishedAt: Date;
  expiresAt: Date;
  isOwnListing: boolean;
  images: MarketplaceImageDto[];
};
export type MarketplaceListingDetailDto = MarketplaceListingSummaryDto;
export type MarketplaceVatFilter = "all" | "yes" | "no";

type Cursor = { publishedAt: string; id: string };
const cursorSchema = z.object({ publishedAt: z.iso.datetime(), id: z.uuid() }).strict();

export function decodeMarketplaceCursor(value: string): Cursor {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (!parsed.success) throw new Error("invalid");
    return parsed.data;
  } catch {
    throw new AccessError(400, "INVALID_MARKETPLACE_CURSOR");
  }
}

function encodeCursor(row: { publishedAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ publishedAt: row.publishedAt.toISOString(), id: row.id }))
    .toString("base64url");
}

function identifier(row: {
  inputKind: "registration" | "model";
  registrationNumber: string | null;
  vehicleModel: string | null;
}): VehicleIdentifier {
  if (row.inputKind === "registration" && row.registrationNumber) return { kind: "registration", value: row.registrationNumber };
  if (row.inputKind === "model" && row.vehicleModel) return { kind: "model", value: row.vehicleModel };
  throw new Error("Vehicle listing identifier invariant violated");
}

type MarketplaceRow = {
  id: string;
  sellerCompanyId: string;
  inputKind: "registration" | "model";
  registrationNumber: string | null;
  vehicleModel: string | null;
  mileageKm: number;
  modelYear: number | null;
  shortComment: string;
  deductibleVat: boolean;
  publishedAt: Date;
  expiresAt: Date;
};

function toDto(row: MarketplaceRow, images: Array<{ position: number }>, activeCompanyId: string): MarketplaceListingSummaryDto {
  if (!Number.isSafeInteger(row.mileageKm) || row.mileageKm % 10 !== 0) {
    throw new Error("Vehicle listing mileage invariant violated");
  }
  return {
    id: row.id,
    identifier: identifier(row),
    mileageMil: row.mileageKm / 10,
    modelYear: row.modelYear,
    shortComment: row.shortComment,
    deductibleVat: row.deductibleVat,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    isOwnListing: row.sellerCompanyId === activeCompanyId,
    images: images.map(({ position }) => ({
      position,
      url: `/api/marketplace/${row.id}/images/${position}`,
    })),
  };
}

const marketplaceSelection = {
  id: vehicleListing.id,
  sellerCompanyId: vehicleListing.sellerCompanyId,
  inputKind: vehicleListing.inputKind,
  registrationNumber: vehicleListing.registrationNumber,
  vehicleModel: vehicleListing.vehicleModel,
  mileageKm: vehicleListing.mileageKm,
  modelYear: vehicleListing.modelYear,
  shortComment: vehicleListing.shortComment,
  deductibleVat: vehicleListing.deductibleVat,
  publishedAt: vehicleListing.publishedAt,
  expiresAt: vehicleListing.expiresAt,
} as const;

export async function listMarketplaceListings(input: {
  activeCompanyId: string;
  search?: string;
  vat?: MarketplaceVatFilter;
  cursor?: string;
  limit?: number;
}): Promise<{ listings: MarketplaceListingSummaryDto[]; nextCursor: string | null }> {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new AccessError(400, "INVALID_PAGE_SIZE");
  }
  const filters: SQL[] = [
    eq(vehicleListing.status, "active"),
    isNotNull(vehicleListing.publishedAt),
    isNotNull(vehicleListing.expiresAt),
    gt(vehicleListing.expiresAt, new Date()),
  ];
  const search = input.search?.trim();
  if (search) {
    if (search.length > 160) throw new AccessError(400, "INVALID_MARKETPLACE_SEARCH");
    filters.push(or(
      ilike(vehicleListing.registrationNumber, `%${search}%`),
      ilike(vehicleListing.vehicleModel, `%${search}%`),
    )!);
  }
  if (input.vat === "yes") filters.push(eq(vehicleListing.deductibleVat, true));
  if (input.vat === "no") filters.push(eq(vehicleListing.deductibleVat, false));
  if (input.cursor) {
    const cursor = decodeMarketplaceCursor(input.cursor);
    const publishedAt = new Date(cursor.publishedAt);
    filters.push(or(
      lt(vehicleListing.publishedAt, publishedAt),
      and(eq(vehicleListing.publishedAt, publishedAt), lt(vehicleListing.id, cursor.id)),
    )!);
  }

  const db = getDb();
  const rows = await db.select(marketplaceSelection).from(vehicleListing)
    .where(and(...filters))
    .orderBy(desc(vehicleListing.publishedAt), desc(vehicleListing.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit) as MarketplaceRow[];
  const images = page.length === 0 ? [] : await db.select({
    listingId: vehicleImage.listingId,
    position: vehicleImage.position,
  }).from(vehicleImage)
    .where(and(
      inArray(vehicleImage.listingId, page.map(({ id }) => id)),
      eq(vehicleImage.position, 1),
      inArray(vehicleImage.plateRedactionStatus, ["NO_PLATE_DETECTED", "PLATE_REDACTED"]),
    ))
    .orderBy(asc(vehicleImage.position));
  return {
    listings: page.map((row) => toDto(row, images.filter((image) => image.listingId === row.id), input.activeCompanyId)),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}

export async function getMarketplaceListing(
  activeCompanyId: string,
  listingId: string,
): Promise<MarketplaceListingDetailDto> {
  const db = getDb();
  const [row] = await db.select(marketplaceSelection).from(vehicleListing).where(and(
    eq(vehicleListing.id, listingId),
    eq(vehicleListing.status, "active"),
    isNotNull(vehicleListing.publishedAt),
    isNotNull(vehicleListing.expiresAt),
    gt(vehicleListing.expiresAt, new Date()),
  )).limit(1);
  if (!row?.publishedAt) throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
  const images = await db.select({ position: vehicleImage.position }).from(vehicleImage)
    .where(and(
      eq(vehicleImage.listingId, row.id),
      inArray(vehicleImage.plateRedactionStatus, ["NO_PLATE_DETECTED", "PLATE_REDACTED"]),
    )).orderBy(asc(vehicleImage.position));
  return toDto(row as MarketplaceRow, images, activeCompanyId);
}

export async function readMarketplaceListingImage(input: {
  activeCompanyId: string;
  listingId: string;
  position: number;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const [image] = await getDb().select({
    objectKey: vehicleImage.objectKey,
    mimeType: vehicleImage.mimeType,
  }).from(vehicleImage).innerJoin(vehicleListing, eq(vehicleListing.id, vehicleImage.listingId)).where(and(
    eq(vehicleImage.listingId, input.listingId),
    eq(vehicleImage.position, input.position),
    inArray(vehicleImage.plateRedactionStatus, ["NO_PLATE_DETECTED", "PLATE_REDACTED"]),
    eq(vehicleListing.status, "active"),
    isNotNull(vehicleListing.publishedAt),
    isNotNull(vehicleListing.expiresAt),
    gt(vehicleListing.expiresAt, new Date()),
  )).limit(1);
  if (!image) throw new AccessError(404, "IMAGE_NOT_FOUND");
  return { bytes: await getImageStorage().read(image.objectKey), mimeType: image.mimeType };
}
