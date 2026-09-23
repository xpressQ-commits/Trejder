import { describe, expect, it } from "vitest";
import { formatMileageKmAsMil, formatOre } from "./formatters";

describe("Swedish formatters", () => {
  it("formats integer ore as SEK", () => {
    expect(formatOre(12_500_000)).toContain("125\u00a0000");
  });

  it("formats canonical kilometers as Swedish mil", () => {
    expect(formatMileageKmAsMil(125_000)).toBe("12\u00a0500 mil");
  });

  it("rejects fractional money", () => {
    expect(() => formatOre(1.5)).toThrow("safe integer");
  });
});
