import { describe, expect, it } from "vitest";
import { equipmentKeys, normalizeEquipment } from "./equipment";

describe("equipment catalog", () => {
  it("contains unique stable keys and removes duplicate selections", () => {
    expect(new Set(equipmentKeys).size).toBe(equipmentKeys.length);
    expect(
      normalizeEquipment(["TOW_HITCH", "TOW_HITCH", "APPLE_CARPLAY"]),
    ).toEqual(["TOW_HITCH", "APPLE_CARPLAY"]);
  });
  it("rejects unknown values", () => {
    expect(() => normalizeEquipment(["UNKNOWN"])).toThrow("INVALID_EQUIPMENT");
  });
});
