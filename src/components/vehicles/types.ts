export type ListingStatus = "draft" | "active" | "withdrawn" | "matched";
export type ListingIdentifier = { kind: "registration" | "model"; value: string };
export type ListingImage = { id: string; position: number; mimeType: string; byteSize: number; url: string };
export type OwnListing = {
  id: string;
  identifier: ListingIdentifier;
  mileageMil: number;
  shortComment: string;
  deductibleVat: boolean;
  status: ListingStatus;
  createdAt: string;
  publishedAt: string | null;
  images: ListingImage[];
};

export const listingStatusLabel: Record<ListingStatus, string> = { draft: "Utkast", active: "Aktiv", withdrawn: "Avslutad", matched: "Matchad" };
export function identifierLabel(identifier: ListingIdentifier) { return identifier.value; }

export function serializeOwnListing(listing: {
  id: string;
  identifier: ListingIdentifier;
  mileageMil: number;
  shortComment: string;
  deductibleVat: boolean;
  status: ListingStatus;
  createdAt: Date;
  publishedAt: Date | null;
  images: ListingImage[];
}): OwnListing {
  return {
    ...listing,
    createdAt: listing.createdAt.toISOString(),
    publishedAt: listing.publishedAt?.toISOString() ?? null,
  };
}
