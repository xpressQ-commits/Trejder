import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlateRedactionRequired } from "./listings";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("plate-redaction publication policy", () => {
  it("keeps publication available when the optional provider is absent", () => {
    vi.stubEnv("PLATE_RECOGNIZER_API_TOKEN", "");
    vi.stubEnv("PLATE_REDACTION_REQUIRED", "false");
    expect(isPlateRedactionRequired()).toBe(false);
  });

  it("fails closed when a provider token is configured", () => {
    vi.stubEnv("PLATE_RECOGNIZER_API_TOKEN", "configured-token");
    vi.stubEnv("PLATE_REDACTION_REQUIRED", "false");
    expect(isPlateRedactionRequired()).toBe(true);
  });

  it("supports explicitly requiring redaction in every environment", () => {
    vi.stubEnv("PLATE_RECOGNIZER_API_TOKEN", "");
    vi.stubEnv("PLATE_REDACTION_REQUIRED", "true");
    expect(isPlateRedactionRequired()).toBe(true);
  });
});
