import { afterEach, describe, expect, it } from "vitest";
import { AccessError, assertSameOrigin, constantTimeTextEqual, normalizeEmail } from "./security";

const previousBaseUrl = process.env.BETTER_AUTH_URL;

afterEach(() => {
  if (previousBaseUrl === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = previousBaseUrl;
});

describe("request security", () => {
  it("accepts the configured origin regardless of URL path", () => {
    process.env.BETTER_AUTH_URL = "https://trejder.example/auth";
    expect(() => assertSameOrigin(new Request("https://trejder.example/api", {
      headers: { origin: "https://trejder.example" },
    }))).not.toThrow();
  });

  it.each([
    ["a missing Origin header", undefined],
    ["a foreign Origin header", "https://attacker.example"],
    ["an origin that only shares a hostname suffix", "https://trejder.example.attacker.example"],
  ])("rejects %s", (_label, origin) => {
    process.env.BETTER_AUTH_URL = "https://trejder.example";
    const headers = origin ? { origin } : undefined;
    expect(() => assertSameOrigin(new Request("https://trejder.example/api", { headers })))
      .toThrowError(expect.objectContaining<Partial<AccessError>>({ status: 403, code: "INVALID_ORIGIN" }));
  });
});

describe("identity helpers", () => {
  it("normalizes email casing and surrounding whitespace", () => {
    expect(normalizeEmail("  ADMIN@Example.SE  ")).toBe("admin@example.se");
  });

  it("compares exact normalized identity values", () => {
    expect(constantTimeTextEqual("admin@example.se", "admin@example.se")).toBe(true);
    expect(constantTimeTextEqual("admin@example.se", "other@example.se")).toBe(false);
    expect(constantTimeTextEqual("short", "longer")).toBe(false);
  });
});
