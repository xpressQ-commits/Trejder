export type MarketplaceImage = {
  position: number;
  url: string;
};

export type MarketplaceListingSummary = {
  id: string;
  identifier: { kind: "registration" | "model"; value: string };
  mileageMil: number;
  modelYear: number | null;
  shortComment: string;
  county: string | null;
  equipment: import("@/domain/equipment").EquipmentKey[];
  otherEquipment: string | null;
  deductibleVat: boolean;
  publishedAt: string;
  expiresAt: string | null;
  isOwnListing: boolean;
  images: MarketplaceImage[];
};

export type MarketplaceListingDetail = MarketplaceListingSummary & {
  registrationNumber: string | null;
  deviations: import("@/domain/listing-details").ListingDeviation[];
  wantedComment: string | null;
  damageImages: MarketplaceImage[];
  documents: Array<{
    id: string;
    name: string;
    mimeType: string;
    byteSize: number;
    url: string;
  }>;
  publisher: {
    kind: "dealer" | "private";
    companyName: string;
    organizationNumber: string;
    contactName: string;
    email: string;
    phone: string | null;
  } | null;
};

export type MarketplacePage = {
  listings: MarketplaceListingSummary[];
  nextCursor: string | null;
};
