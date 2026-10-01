import { describe, expect, it } from "vitest";
import { canEditActiveListingFields, maxModelYear, normalizeIdentifier, normalizeMileageMil, normalizeModelYear } from "./vehicle-listing";

describe("vehicle listing policy", () => {
  it("normalizes integer Swedish mil to integer kilometres", () => {
    expect(normalizeMileageMil(6430)).toBe(64_300);
    expect(() => normalizeMileageMil(1.5)).toThrow("INVALID_MILEAGE");
  });
  it("normalizes but does not infer identifiers", () => {
    expect(normalizeIdentifier({ kind: "registration", value: "abc 123" })).toEqual({ kind: "registration", value: "ABC123" });
    expect(normalizeIdentifier({ kind: "model", value: " BMW   M340i " })).toEqual({ kind: "model", value: "BMW M340i" });
  });
  it("accepts model years from 1950 through next year", () => {
    expect(normalizeModelYear(1950)).toBe(1950);
    expect(normalizeModelYear(maxModelYear())).toBe(maxModelYear());
    expect(() => normalizeModelYear(1949)).toThrow("INVALID_MODEL_YEAR");
    expect(() => normalizeModelYear(maxModelYear() + 1)).toThrow("INVALID_MODEL_YEAR");
    expect(() => normalizeModelYear(2020.5)).toThrow("INVALID_MODEL_YEAR");
  });
  it("only permits comment corrections after publication", () => {
    expect(canEditActiveListingFields(["shortComment"])).toBe(true);
    expect(canEditActiveListingFields(["mileageMil"])).toBe(false);
  });
});
