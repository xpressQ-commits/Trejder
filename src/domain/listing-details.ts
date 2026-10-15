export const listingDeviationKeys = [
  "WAS_WANTED",
  "PRIVATE_IMPORT",
  "MILEAGE_HISTORY_ANOMALY",
  "REPAIRED",
] as const;

export type ListingDeviation = (typeof listingDeviationKeys)[number];

export const MAX_WANTED_COMMENT_LENGTH = 500;

export function normalizeDeviations(
  values: readonly ListingDeviation[],
): ListingDeviation[] {
  const allowed = new Set<string>(listingDeviationKeys);
  if (values.some((value) => !allowed.has(value))) {
    throw new Error("INVALID_LISTING_DEVIATION");
  }
  return [...new Set(values)];
}

export function normalizeWantedComment(
  value: string | null | undefined,
  deviations: readonly ListingDeviation[],
): string | null {
  const normalized = value?.trim() ?? "";
  if (normalized.length > MAX_WANTED_COMMENT_LENGTH) {
    throw new Error("INVALID_WANTED_COMMENT");
  }
  return deviations.includes("WAS_WANTED") && normalized ? normalized : null;
}

export type ListingLocation = {
  postalCode: string;
  locality: string;
  county: string;
};

export function normalizeListingLocation(input: ListingLocation): ListingLocation {
  const postalCode = input.postalCode.replace(/\s+/g, "");
  const locality = input.locality.trim().replace(/\s+/g, " ");
  const county = input.county.trim().replace(/\s+/g, " ");
  if (!/^[1-9][0-9]{4}$/.test(postalCode)) {
    throw new Error("INVALID_POSTAL_CODE");
  }
  if (!locality || locality.length > 120 || !county || county.length > 120) {
    throw new Error("INVALID_LISTING_LOCATION");
  }
  return { postalCode, locality, county };
}
