export type ListingStatus =
  "draft" | "active" | "inactive" | "withdrawn" | "matched";
export type ListingIdentifier = {
  kind: "registration" | "model";
  value: string;
};
export type PlateRedactionStatus =
  | "NOT_CHECKED"
  | "PROCESSING"
  | "NO_PLATE_DETECTED"
  | "PLATE_REDACTED"
  | "REVIEW_REQUIRED"
  | "FAILED";
export type ListingImage = {
  id: string;
  position: number;
  mimeType: string;
  byteSize: number;
  plateRedactionStatus: PlateRedactionStatus;
  plateConfidence: number | null;
  url: string;
};
export type OwnListing = {
  id: string;
  identifier: ListingIdentifier;
  mileageMil: number;
  modelYear: number | null;
  shortComment: string;
  equipment: import("@/domain/equipment").EquipmentKey[];
  otherEquipment: string | null;
  deductibleVat: boolean;
  status: ListingStatus;
  publicationHours: number | null;
  createdAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
  images: ListingImage[];
};

export const listingStatusLabel: Record<ListingStatus, string> = {
  draft: "Utkast",
  active: "Aktiv",
  inactive: "Inaktiv",
  withdrawn: "Avslutad",
  matched: "Matchad",
};
export function identifierLabel(identifier: ListingIdentifier) {
  return identifier.value;
}

export function serializeOwnListing(listing: {
  id: string;
  identifier: ListingIdentifier;
  mileageMil: number;
  modelYear: number | null;
  shortComment: string;
  equipment: import("@/domain/equipment").EquipmentKey[];
  otherEquipment: string | null;
  deductibleVat: boolean;
  status: ListingStatus;
  publicationHours: number | null;
  createdAt: Date;
  publishedAt: Date | null;
  expiresAt: Date | null;
  images: ListingImage[];
}): OwnListing {
  return {
    ...listing,
    createdAt: listing.createdAt.toISOString(),
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    expiresAt: listing.expiresAt?.toISOString() ?? null,
  };
}
