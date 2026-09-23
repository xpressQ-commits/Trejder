import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./navigation";

describe("safeReturnTo", () => {
  it.each(["/app", "/app/anvandare", `/inbjudan/${"a".repeat(32)}`])("allows internal application paths: %s", (path) => expect(safeReturnTo(path)).toBe(path));
  it.each([undefined, "https://evil.example", "//evil.example", "/\\evil.example", "/app\nevil", "/logga-in"])('rejects unsafe or unsupported return path: %s', (path) => expect(safeReturnTo(path)).toBe("/app"));
});
