import { describe, expect, it } from "vitest";
import { canEditActiveListingFields, normalizeIdentifier, normalizeMileageMil } from "./vehicle-listing";

describe("vehicle listing policy", () => {
  it("normalizes integer Swedish mil to integer kilometres", () => {
    expect(normalizeMileageMil(6430)).toBe(64_300);
    expect(() => normalizeMileageMil(1.5)).toThrow("INVALID_MILEAGE");
  });
  it("normalizes but does not infer identifiers", () => {
    expect(normalizeIdentifier({ kind: "registration", value: "abc 123" })).toEqual({ kind: "registration", value: "ABC123" });
    expect(normalizeIdentifier({ kind: "model", value: " BMW   M340i " })).toEqual({ kind: "model", value: "BMW M340i" });
  });
  it("only permits comment corrections after publication", () => {
    expect(canEditActiveListingFields(["shortComment"])).toBe(true);
    expect(canEditActiveListingFields(["mileageMil"])).toBe(false);
  });
});
