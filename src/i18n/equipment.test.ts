import { describe, expect, it } from "vitest";
import { equipmentLabel } from "./equipment";

describe("equipment translations", () => {
  it("renders Swedish and English labels from the same stable key", () => {
    expect(equipmentLabel("sv", "SURROUND_VIEW_CAMERA")).toBe("360° kamera");
    expect(equipmentLabel("en", "SURROUND_VIEW_CAMERA")).toBe("360° camera");
    expect(equipmentLabel("sv", "HARMAN_KARDON")).toBe("Harman/Kardon");
  });
});
