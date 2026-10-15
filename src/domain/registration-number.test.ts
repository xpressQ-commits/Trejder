import { describe, expect, it } from "vitest";
import {
  canViewRegistrationNumber,
  formatRegistrationNumber,
  normalizeRegistrationNumber,
  shouldRedactLicensePlate,
} from "./registration-number";

describe("registration number policy", () => {
  it.each([
    ["abc123", "ABC123"],
    ["ABC 123", "ABC123"],
    [" abc 12d ", "ABC12D"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeRegistrationNumber(input)).toBe(expected);
  });

  it("rejects empty and malformed values without assuming every vehicle is Swedish", () => {
    expect(() => normalizeRegistrationNumber("  ")).toThrow();
    expect(() => normalizeRegistrationNumber("ABC/123")).toThrow();
    expect(normalizeRegistrationNumber("TRAILER-42")).toBe("TRAILER-42");
  });

  it.each([
    ["ABC123", "ABC 123"],
    ["ABC12D", "ABC 12D"],
    ["TRAILER-42", "TRAILER-42"],
  ])("formats %s for display", (input, expected) => {
    expect(formatRegistrationNumber(input)).toBe(expected);
  });

  it("keeps the backend visibility decision centralized", () => {
    expect(canViewRegistrationNumber({ isSeller: true, showRegistrationNumber: false, hasMarketplaceAccess: false })).toBe(true);
    expect(canViewRegistrationNumber({ isSeller: false, showRegistrationNumber: true, hasMarketplaceAccess: true })).toBe(true);
    expect(canViewRegistrationNumber({ isSeller: false, showRegistrationNumber: true, hasMarketplaceAccess: false })).toBe(false);
    expect(canViewRegistrationNumber({ isSeller: false, showRegistrationNumber: false, hasMarketplaceAccess: true })).toBe(false);
    expect(canViewRegistrationNumber({ isSeller: false, isPlatformAdmin: true, showRegistrationNumber: false, hasMarketplaceAccess: false })).toBe(true);
    expect(canViewRegistrationNumber({ isSeller: false, isAcceptedBuyer: true, showRegistrationNumber: false, hasMarketplaceAccess: false })).toBe(true);
  });

  it("only redacts plates when the seller hides the registration number", () => {
    expect(shouldRedactLicensePlate(false)).toBe(true);
    expect(shouldRedactLicensePlate(true)).toBe(false);
  });
});
