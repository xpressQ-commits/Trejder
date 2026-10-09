import { describe, expect, it } from "vitest";
import {
  canEditActiveListingFields,
  isListingExpired,
  maxModelYear,
  normalizeIdentifier,
  normalizeMileageMil,
  normalizeModelYear,
  normalizePublicationHours,
} from "./vehicle-listing";

describe("vehicle listing policy", () => {
  it("normalizes integer Swedish mil to integer kilometres", () => {
    expect(normalizeMileageMil(6430)).toBe(64_300);
    expect(() => normalizeMileageMil(1.5)).toThrow("INVALID_MILEAGE");
  });
  it("normalizes but does not infer identifiers", () => {
    expect(
      normalizeIdentifier({ kind: "registration", value: "abc 123" }),
    ).toEqual({ kind: "registration", value: "ABC123" });
    expect(
      normalizeIdentifier({ kind: "model", value: " BMW   M340i " }),
    ).toEqual({ kind: "model", value: "BMW M340i" });
  });
  it("accepts model years from 1950 through next year", () => {
    expect(normalizeModelYear(1950)).toBe(1950);
    expect(normalizeModelYear(maxModelYear())).toBe(maxModelYear());
    expect(() => normalizeModelYear(1949)).toThrow("INVALID_MODEL_YEAR");
    expect(() => normalizeModelYear(maxModelYear() + 1)).toThrow(
      "INVALID_MODEL_YEAR",
    );
    expect(() => normalizeModelYear(2020.5)).toThrow("INVALID_MODEL_YEAR");
  });
  it("only permits comment corrections after publication", () => {
    expect(canEditActiveListingFields(["shortComment"])).toBe(true);
    expect(canEditActiveListingFields(["mileageMil"])).toBe(false);
  });
  it("derives inactivity only for a timed active listing after expiry", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    expect(
      isListingExpired(
        { status: "active", expiresAt: new Date("2026-10-09T11:59:59Z") },
        now,
      ),
    ).toBe(true);
    expect(
      isListingExpired(
        { status: "active", expiresAt: new Date("2026-10-09T12:00:01Z") },
        now,
      ),
    ).toBe(false);
    expect(isListingExpired({ status: "active", expiresAt: null }, now)).toBe(
      false,
    );
    expect(
      isListingExpired(
        { status: "matched", expiresAt: new Date("2026-10-08T00:00:00Z") },
        now,
      ),
    ).toBe(false);
  });
  it("allows unlimited publication only for the platform owner", () => {
    expect(normalizePublicationHours(null, true)).toBeNull();
    expect(() => normalizePublicationHours(null, false)).toThrow(
      "UNLIMITED_PUBLICATION_FORBIDDEN",
    );
    expect(normalizePublicationHours(48, false)).toBe(48);
    expect(() => normalizePublicationHours(49, true)).toThrow(
      "INVALID_PUBLICATION_DURATION",
    );
  });
});
