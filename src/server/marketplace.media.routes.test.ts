// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "./security";

const companyId = "11111111-1111-4111-8111-111111111111";
const listingId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  requireDealerMembershipPermission: vi.fn(),
  getCompanySubscriptionAccess: vi.fn(),
  hasPlatformAdminAuthority: vi.fn(),
  readMarketplaceListingImage: vi.fn(),
  readMarketplaceListingDocument: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: companyId }) })),
}));
vi.mock("@/server/company/context", () => ({
  ACTIVE_COMPANY_COOKIE: "trejder_company",
  requireDealerMembershipPermission: mocks.requireDealerMembershipPermission,
}));
vi.mock("@/server/billing", () => ({
  getCompanySubscriptionAccess: mocks.getCompanySubscriptionAccess,
}));
vi.mock("@/server/platform-admin", () => ({
  hasPlatformAdminAuthority: mocks.hasPlatformAdminAuthority,
}));
vi.mock("@/server/marketplace/listings", () => ({
  readMarketplaceListingImage: mocks.readMarketplaceListingImage,
  readMarketplaceListingDocument: mocks.readMarketplaceListingDocument,
}));

import { GET as getImage } from "@/app/api/marketplace/[listingId]/images/[position]/route";
import { GET as getDocument } from "@/app/api/marketplace/[listingId]/documents/[documentId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireDealerMembershipPermission.mockResolvedValue({
    company: { id: companyId },
    membership: { role: "trader" },
    user: { id: "user-1" },
  });
  mocks.getCompanySubscriptionAccess.mockResolvedValue({ canAccess: false });
  mocks.hasPlatformAdminAuthority.mockResolvedValue(false);
  mocks.readMarketplaceListingImage.mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/webp",
  });
  mocks.readMarketplaceListingDocument.mockResolvedValue({
    bytes: new TextEncoder().encode("%PDF-1.7\n%%EOF"),
    mimeType: "application/pdf",
    name: "servicehistorik.pdf",
  });
});

describe("marketplace protected media routes", () => {
  it("passes an unpaid entitlement to the server-side image variant selector", async () => {
    const response = await getImage(
      new Request(`https://trejder.test/api/marketplace/${listingId}/images/1`),
      { params: Promise.resolve({ listingId, position: "1" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.readMarketplaceListingImage).toHaveBeenCalledWith({
      activeCompanyId: companyId,
      listingId,
      position: 1,
      hasMarketplaceAccess: false,
      canViewPrivilegedDetails: false,
    });
  });

  it("never reads a document when fresh dealer authorization fails", async () => {
    mocks.requireDealerMembershipPermission.mockRejectedValueOnce(
      new AccessError(403, "ACTIVE_MEMBERSHIP_REQUIRED"),
    );
    const response = await getDocument(
      new Request(`https://trejder.test/api/marketplace/${listingId}/documents/${documentId}`),
      { params: Promise.resolve({ listingId, documentId }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.readMarketplaceListingDocument).not.toHaveBeenCalled();
  });

  it("serves an authorized document with hardened headers", async () => {
    const response = await getDocument(
      new Request(`https://trejder.test/api/marketplace/${listingId}/documents/${documentId}`),
      { params: Promise.resolve({ listingId, documentId }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(mocks.readMarketplaceListingDocument).toHaveBeenCalledWith({
      listingId,
      documentId,
    });
  });
});
