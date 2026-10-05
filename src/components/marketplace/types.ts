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
  equipment: import("@/domain/equipment").EquipmentKey[];
  otherEquipment: string | null;
  deductibleVat: boolean;
  publishedAt: string;
  expiresAt: string;
  isOwnListing: boolean;
  images: MarketplaceImage[];
};

export type MarketplacePage = {
  listings: MarketplaceListingSummary[];
  nextCursor: string | null;
};
