import { describe, expect, it } from "vitest";
import { canViewFullListingImage } from "./image-access";

describe("listing image access", () => {
  it.each([
    [{ isSeller: true, isPrivilegedAdmin: false, hasActiveMarketplaceAccess: false }, true],
    [{ isSeller: false, isPrivilegedAdmin: true, hasActiveMarketplaceAccess: false }, true],
    [{ isSeller: false, isPrivilegedAdmin: false, hasActiveMarketplaceAccess: true }, true],
    [{ isSeller: false, isPrivilegedAdmin: false, hasActiveMarketplaceAccess: false }, false],
  ] as const)("resolves the server-side full-image matrix", (input, expected) => {
    expect(canViewFullListingImage(input)).toBe(expected);
  });
});
