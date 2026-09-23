export type MatchFeeSnapshot = Readonly<{
  commercialTermsVersion: string;
  sellerFeeExVatOre: number;
  buyerFeeExVatOre: number;
  currency: "SEK";
}>;

const DEALER_V1 = {
  commercialTermsVersion: "dealer-v1",
  sellerFeeExVatOre: 49_900,
  buyerFeeExVatOre: 49_900,
  currency: "SEK",
} as const satisfies MatchFeeSnapshot;

/** Server-owned policy. Never construct fee snapshots from request data. */
export function currentDealerMatchFees(): MatchFeeSnapshot {
  return DEALER_V1;
}
