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
  deductibleVat: boolean;
  publishedAt: string;
  images: MarketplaceImage[];
};

export type MarketplacePage = {
  listings: MarketplaceListingSummary[];
  nextCursor: string | null;
};
