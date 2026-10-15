import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupSwedishPostcode, normalizeSwedishCounty } from "./postcodes";

afterEach(() => vi.unstubAllGlobals());

describe("Swedish postcode lookup", () => {
  it("maps provider locality and region to the stored county projection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      "post code": "14152",
      places: [{ "place name": "Huddinge", state: "Stockholm" }],
    }))));
    await expect(lookupSwedishPostcode("141 52")).resolves.toEqual([
      { postalCode: "14152", locality: "Huddinge", county: "Stockholms län" },
    ]);
  });

  it("handles the Gotland county genitive", () => {
    expect(normalizeSwedishCounty("Gotland")).toBe("Gotlands län");
  });
});
