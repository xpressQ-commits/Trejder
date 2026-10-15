import { describe, expect, it } from "vitest";
import {
  normalizeDeviations,
  normalizeListingLocation,
  normalizeWantedComment,
} from "./listing-details";

describe("listing details", () => {
  it("accepts multiple known deviations and rejects unknown keys", () => {
    expect(normalizeDeviations(["PRIVATE_IMPORT", "REPAIRED"])).toEqual([
      "PRIVATE_IMPORT",
      "REPAIRED",
    ]);
    expect(() => normalizeDeviations(["UNKNOWN" as never])).toThrow(
      "INVALID_LISTING_DEVIATION",
    );
  });

  it("keeps a wanted comment only while the wanted flag is active", () => {
    expect(normalizeWantedComment(" Återfunnen ", ["WAS_WANTED"])).toBe(
      "Återfunnen",
    );
    expect(normalizeWantedComment("Återfunnen", [])).toBeNull();
  });

  it("normalizes a Swedish postcode without exposing an address", () => {
    expect(
      normalizeListingLocation({
        postalCode: "141 52",
        locality: " Huddinge ",
        county: "Stockholms län",
      }),
    ).toEqual({
      postalCode: "14152",
      locality: "Huddinge",
      county: "Stockholms län",
    });
  });
});
