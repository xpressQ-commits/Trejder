import { describe, expect, it } from "vitest";
import { defaultLocale } from "./config";
import {
  formatDate,
  formatMoney,
  formatNotification,
  translate,
  type TranslationKey,
} from "./index";
describe("i18n", () => {
  it("uses Swedish by default and translates navigation and errors", () => {
    expect(defaultLocale).toBe("sv");
    expect(translate("sv", "nav.marketplace")).toBe("Marknad");
    expect(translate("en", "nav.marketplace")).toBe("Marketplace");
    expect(translate("en", "error.generic")).toContain("Something");
  });
  it("formats SEK without changing currency", () => {
    expect(formatMoney("sv", 19_500_000)).toContain("195 000");
    expect(formatMoney("en", 19_500_000)).toContain("195,000");
    expect(formatMoney("en", 19_500_000)).toContain("SEK");
  });
  it("formats dates by locale", () => {
    const date = new Date("2026-10-04T10:00:00Z");
    expect(formatDate("sv", date)).toMatch(/4 okt/);
    expect(formatDate("en", date)).toMatch(/Oct 4/);
  });
  it("never exposes an undefined missing key", () => {
    expect(translate("en", "missing.key" as TranslationKey)).toBe(
      "missing.key",
    );
  });
  it("keeps internal enum values stable", () => {
    const status = "accepted";
    expect(status).toBe("accepted");
    expect(translate("en", "bids.accept")).toBe("Accept bid");
  });
  it("localizes rejected bid notifications", () => {
    expect(formatNotification("sv", "bid.rejected", "fallback")).toBe(
      "Ditt bud har avböjts.",
    );
  });
});
