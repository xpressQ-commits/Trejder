import { Buffer } from "node:buffer";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  isNotNull,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import type { VehicleIdentifier } from "@/domain/vehicle-listing";
import { canViewRegistrationNumber } from "@/domain/registration-number";
import { normalizeEquipment, type EquipmentKey } from "@/domain/equipment";
import { getDb } from "@/server/db";
import {
  company,
  companyMembership,
  user,
  vehicleImage,
  vehicleListing,
} from "@/server/db/schema";
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
  equipment: EquipmentKey[];
  otherEquipment: string | null;
  deductibleVat: boolean;
  publishedAt: Date;
  expiresAt: Date | null;
  isOwnListing: boolean;
  images: MarketplaceImageDto[];
};
export type MarketplaceListingDetailDto = MarketplaceListingSummaryDto & {
  registrationNumber: string | null;
  publisher: {
    kind: "dealer" | "private";
    companyName: string;
    organizationNumber: string;
    contactName: string;
    email: string;
    phone: string | null;
  } | null;
};
export type MarketplaceVatFilter = "all" | "yes" | "no";

type Cursor = { publishedAt: string; id: string };
const cursorSchema = z
  .object({ publishedAt: z.iso.datetime(), id: z.uuid() })
  .strict();

export function decodeMarketplaceCursor(value: string): Cursor {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    if (!parsed.success) throw new Error("invalid");
    return parsed.data;
  } catch {
    throw new AccessError(400, "INVALID_MARKETPLACE_CURSOR");
  }
}

function encodeCursor(row: { publishedAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ publishedAt: row.publishedAt.toISOString(), id: row.id }),
  ).toString("base64url");
}

function identifier(row: {
  vehicleModel: string | null;
}): VehicleIdentifier {
  if (row.vehicleModel)
    return { kind: "model", value: row.vehicleModel };
  return { kind: "model", value: "Bilannons" };
}

type MarketplaceRow = {
  id: string;
  sellerCompanyId: string;
  showRegistrationNumber: boolean;
  vehicleModel: string | null;
  mileageKm: number;
  modelYear: number | null;
  shortComment: string;
  equipment: string[];
  otherEquipment: string | null;
  deductibleVat: boolean;
  publishedAt: Date;
  expiresAt: Date | null;
};

function toDto(
  row: MarketplaceRow,
  images: Array<{ position: number }>,
  activeCompanyId: string,
): MarketplaceListingSummaryDto {
  if (!Number.isSafeInteger(row.mileageKm) || row.mileageKm % 10 !== 0) {
    throw new Error("Vehicle listing mileage invariant violated");
  }
  return {
    id: row.id,
    identifier: identifier(row),
    mileageMil: row.mileageKm / 10,
    modelYear: row.modelYear,
    shortComment: row.shortComment,
    equipment: normalizeEquipment(row.equipment),
    otherEquipment: row.otherEquipment,
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
  showRegistrationNumber: vehicleListing.showRegistrationNumber,
  vehicleModel: vehicleListing.vehicleModel,
  mileageKm: vehicleListing.mileageKm,
  modelYear: vehicleListing.modelYear,
  shortComment: vehicleListing.shortComment,
  equipment: vehicleListing.equipment,
  otherEquipment: vehicleListing.otherEquipment,
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
}): Promise<{
  listings: MarketplaceListingSummaryDto[];
  nextCursor: string | null;
}> {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new AccessError(400, "INVALID_PAGE_SIZE");
  }
  const filters: SQL[] = [
    eq(vehicleListing.status, "active"),
    isNotNull(vehicleListing.publishedAt),
    or(
      isNull(vehicleListing.expiresAt),
      gt(vehicleListing.expiresAt, new Date()),
    )!,
  ];
  const search = input.search?.trim();
  if (search) {
    if (search.length > 160)
      throw new AccessError(400, "INVALID_MARKETPLACE_SEARCH");
    filters.push(
      ilike(vehicleListing.vehicleModel, `%${search}%`),
    );
  }
  if (input.vat === "yes") filters.push(eq(vehicleListing.deductibleVat, true));
  if (input.vat === "no") filters.push(eq(vehicleListing.deductibleVat, false));
  if (input.cursor) {
    const cursor = decodeMarketplaceCursor(input.cursor);
    const publishedAt = new Date(cursor.publishedAt);
    filters.push(
      or(
        lt(vehicleListing.publishedAt, publishedAt),
        and(
          eq(vehicleListing.publishedAt, publishedAt),
          lt(vehicleListing.id, cursor.id),
        ),
      )!,
    );
  }

  const db = getDb();
  const rows = await db
    .select(marketplaceSelection)
    .from(vehicleListing)
    .where(and(...filters))
    .orderBy(desc(vehicleListing.publishedAt), desc(vehicleListing.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit) as MarketplaceRow[];
  const images =
    page.length === 0
      ? []
      : await db
          .select({
            listingId: vehicleImage.listingId,
            position: vehicleImage.position,
            status: vehicleImage.plateRedactionStatus,
          })
          .from(vehicleImage)
          .where(
            and(
              inArray(
                vehicleImage.listingId,
                page.map(({ id }) => id),
              ),
              eq(vehicleImage.position, 1),
            ),
          )
          .orderBy(asc(vehicleImage.position));
  return {
    listings: page.map((row) =>
      toDto(
        row,
        images.filter(
          (image) =>
            image.listingId === row.id &&
            (row.showRegistrationNumber ||
              ["NO_PLATE_DETECTED", "PLATE_REDACTED"].includes(image.status)),
        ),
        input.activeCompanyId,
      ),
    ),
    nextCursor:
      rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}

export async function getMarketplaceListing(
  activeCompanyId: string,
  listingId: string,
  hasMarketplaceAccess = false,
  canViewPrivilegedDetails = false,
): Promise<MarketplaceListingDetailDto> {
  const db = getDb();
  const [row] = await db
    .select({
      ...marketplaceSelection,
      registrationNumber: vehicleListing.registrationNumber,
      createdByUserId: vehicleListing.createdByUserId,
    })
    .from(vehicleListing)
    .where(
      and(
        eq(vehicleListing.id, listingId),
        eq(vehicleListing.status, "active"),
        isNotNull(vehicleListing.publishedAt),
        or(
          isNull(vehicleListing.expiresAt),
          gt(vehicleListing.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  if (!row?.publishedAt)
    throw new AccessError(404, "MARKETPLACE_LISTING_NOT_FOUND");
  const images = await db
    .select({
      position: vehicleImage.position,
      status: vehicleImage.plateRedactionStatus,
    })
    .from(vehicleImage)
    .where(
      and(
        eq(vehicleImage.listingId, row.id),
      ),
    )
    .orderBy(asc(vehicleImage.position));
  const detail = toDto(
    row as MarketplaceRow,
    images.filter(
      (image) =>
        row.showRegistrationNumber ||
        ["NO_PLATE_DETECTED", "PLATE_REDACTED"].includes(image.status),
    ),
    activeCompanyId,
  );
  const [publisher] = canViewPrivilegedDetails
    ? await db
        .select({
          kind: company.kind,
          companyName: company.legalName,
          organizationNumber: company.organizationNumber,
          contactName: user.name,
          email: user.email,
          membershipPhone: companyMembership.phone,
          companyPhone: company.contactPhone,
        })
        .from(company)
        .innerJoin(user, eq(user.id, row.createdByUserId))
        .leftJoin(
          companyMembership,
          and(
            eq(companyMembership.companyId, company.id),
            eq(companyMembership.userId, user.id),
          ),
        )
        .where(eq(company.id, row.sellerCompanyId))
        .limit(1)
    : [];
  return {
    ...detail,
    registrationNumber: canViewRegistrationNumber({
      isSeller: row.sellerCompanyId === activeCompanyId,
      isPlatformAdmin: canViewPrivilegedDetails,
      showRegistrationNumber: row.showRegistrationNumber,
      hasMarketplaceAccess,
    })
      ? row.registrationNumber
      : null,
    publisher: publisher
      ? {
          kind: publisher.kind,
          companyName: publisher.companyName,
          organizationNumber: publisher.organizationNumber,
          contactName: publisher.contactName,
          email: publisher.email,
          phone: publisher.membershipPhone ?? publisher.companyPhone,
        }
      : null,
  };
}

export async function readMarketplaceListingImage(input: {
  activeCompanyId: string;
  listingId: string;
  position: number;
}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const [image] = await getDb()
    .select({
      objectKey: vehicleImage.objectKey,
      mimeType: vehicleImage.mimeType,
    })
    .from(vehicleImage)
    .innerJoin(vehicleListing, eq(vehicleListing.id, vehicleImage.listingId))
    .where(
      and(
        eq(vehicleImage.listingId, input.listingId),
        eq(vehicleImage.position, input.position),
        or(
          eq(vehicleListing.showRegistrationNumber, true),
          inArray(vehicleImage.plateRedactionStatus, [
            "NO_PLATE_DETECTED",
            "PLATE_REDACTED",
          ]),
        ),
        eq(vehicleListing.status, "active"),
        isNotNull(vehicleListing.publishedAt),
        or(
          isNull(vehicleListing.expiresAt),
          gt(vehicleListing.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  if (!image) throw new AccessError(404, "IMAGE_NOT_FOUND");
  return {
    bytes: await getImageStorage().read(image.objectKey),
    mimeType: image.mimeType,
  };
}
