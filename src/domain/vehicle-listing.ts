export const MAX_LISTING_COMMENT_LENGTH = 500;
export const MAX_MILEAGE_MIL = 200_000;
export const MIN_MODEL_YEAR = 1950;

export function maxModelYear(now = new Date()): number {
  return now.getUTCFullYear() + 1;
}

export function normalizeModelYear(value: number, now = new Date()): number {
  if (!Number.isSafeInteger(value) || value < MIN_MODEL_YEAR || value > maxModelYear(now)) {
    throw new Error("INVALID_MODEL_YEAR");
  }
  return value;
}

export type VehicleIdentifier =
  | { kind: "registration"; value: string }
  | { kind: "model"; value: string };

export function normalizeMileageMil(mileageMil: number): number {
  if (!Number.isSafeInteger(mileageMil) || mileageMil < 0 || mileageMil > MAX_MILEAGE_MIL) {
    throw new Error("INVALID_MILEAGE");
  }
  return mileageMil * 10;
}

export function normalizeIdentifier(identifier: VehicleIdentifier): VehicleIdentifier {
  const value = identifier.kind === "registration"
    ? identifier.value.replace(/\s+/g, "").toUpperCase()
    : identifier.value.trim().replace(/\s+/g, " ");
  const max = identifier.kind === "registration" ? 16 : 160;
  if (!value || value.length > max) throw new Error("INVALID_IDENTIFIER");
  return { kind: identifier.kind, value };
}

export function canEditActiveListingFields(keys: readonly string[]): boolean {
  return keys.every((key) => key === "shortComment" || key === "equipment" || key === "otherEquipment");
}
