import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { company, companyMembership, user, vehicleImage, vehicleListing } from "@/server/db/schema";
import { setImageStorage, type PrivateImageStorage, type SupportedImageMime } from "@/server/storage/images";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(testDatabaseUrl));

class MemoryStorage implements PrivateImageStorage {
  readonly objects = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array, mimeType: SupportedImageMime) {
    void mimeType;
    this.objects.set(key, bytes);
  }
  async delete(key: string) { this.objects.delete(key); }
  async read(key: string) {
    const value = this.objects.get(key);
    if (!value) throw new Error("missing test image");
    return value;
  }
}

integration("Phase 3 PostgreSQL marketplace visibility", () => {
  const buyerCompany = randomUUID();
  const sellerCompany = randomUUID();
  const thirdCompany = randomUUID();
  const activeViewer = randomUUID();
  const suspendedViewer = randomUUID();
  const revokedViewer = randomUUID();
  const sellerUser = randomUUID();
  const thirdUser = randomUUID();
  const storage = new MemoryStorage();
  const listingIds = {
    newest: randomUUID(),
    older: randomUUID(),
    own: randomUUID(),
    draft: randomUUID(),
    withdrawn: randomUUID(),
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    setImageStorage(storage);
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.insert(user).values([
      { id: activeViewer, name: "Active Viewer", email: `${activeViewer}@example.test`, emailVerified: true },
      { id: suspendedViewer, name: "Suspended Viewer", email: `${suspendedViewer}@example.test`, emailVerified: true },
      { id: revokedViewer, name: "Revoked Viewer", email: `${revokedViewer}@example.test`, emailVerified: true },
      { id: sellerUser, name: "Seller", email: `${sellerUser}@example.test`, emailVerified: true },
      { id: thirdUser, name: "Third", email: `${thirdUser}@example.test`, emailVerified: true },
    ]);
    await db.insert(company).values([
      { id: buyerCompany, legalName: "Marketplace Buyer", organizationNumber: `MB${randomUUID().slice(0, 10)}`, contactEmail: `${activeViewer}@example.test` },
      { id: sellerCompany, legalName: "SECRET SELLER", organizationNumber: `MS${randomUUID().slice(0, 10)}`, contactEmail: "secret-seller@example.test" },
      { id: thirdCompany, legalName: "Third Dealer", organizationNumber: `MT${randomUUID().slice(0, 10)}`, contactEmail: `${thirdUser}@example.test` },
    ]);
    await db.insert(companyMembership).values([
      { companyId: buyerCompany, userId: activeViewer, role: "viewer", status: "active" },
      { companyId: buyerCompany, userId: suspendedViewer, role: "viewer", status: "suspended" },
      { companyId: buyerCompany, userId: revokedViewer, role: "viewer", status: "revoked" },
      { companyId: sellerCompany, userId: sellerUser, role: "trader", status: "active" },
      { companyId: thirdCompany, userId: thirdUser, role: "trader", status: "active" },
    ]);
    await db.insert(vehicleListing).values([
      listing(listingIds.newest, sellerCompany, sellerUser, "active", "AAA111", true, new Date("2026-09-28T12:00:00Z")),
      listing(listingIds.older, thirdCompany, thirdUser, "active", "BBB222", false, new Date("2026-09-28T11:00:00Z")),
      listing(listingIds.own, buyerCompany, activeViewer, "active", "OWN111", true, new Date("2026-09-28T13:00:00Z")),
      listing(listingIds.draft, sellerCompany, sellerUser, "draft", "DRAFT1", true, null),
      listing(listingIds.withdrawn, sellerCompany, sellerUser, "withdrawn", "WITHD1", true, new Date("2026-09-28T10:00:00Z")),
    ]);
    const imageRows = Object.values(listingIds).flatMap((listingId) => [1, 2, 3].map((position) => ({
      listingId,
      position,
      objectKey: `private/${randomUUID()}`,
      mimeType: "image/jpeg",
      byteSize: 6,
      checksumSha256: "a".repeat(64),
      sourceChecksumSha256: "a".repeat(64),
      plateRedactionStatus: "NO_PLATE_DETECTED" as const,
    })));
    await db.insert(vehicleImage).values(imageRows);
    for (const row of imageRows) storage.objects.set(row.objectKey, new Uint8Array([row.position]));
  });

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.delete(vehicleListing).where(inArray(vehicleListing.sellerCompanyId, [buyerCompany, sellerCompany, thirdCompany]));
    await db.delete(companyMembership).where(inArray(companyMembership.companyId, [buyerCompany, sellerCompany, thirdCompany]));
    await db.delete(company).where(inArray(company.id, [buyerCompany, sellerCompany, thirdCompany]));
    await db.delete(user).where(inArray(user.id, [activeViewer, suspendedViewer, revokedViewer, sellerUser, thirdUser]));
  });

  it("returns only other companies' active listings through an anonymous allow-list", async () => {
    const { listMarketplaceListings } = await import("./listings");
    const result = await listMarketplaceListings({ activeCompanyId: buyerCompany });
    expect(result.listings.map(({ id }) => id)).toEqual([listingIds.newest, listingIds.older]);
    expect(result.listings[0]).toEqual({
      id: listingIds.newest,
      identifier: { kind: "registration", value: "AAA111" },
      mileageMil: 6430,
      modelYear: null,
      shortComment: "Marketplace test",
      deductibleVat: true,
      publishedAt: new Date("2026-09-28T12:00:00Z"),
      images: [1, 2, 3].map((position) => ({
        position,
        url: `/api/marketplace/${listingIds.newest}/images/${position}`,
      })),
    });
    expect(JSON.stringify(result)).not.toMatch(/SECRET SELLER|secret-seller|sellerCompany|CompanyId|objectKey|createdBy|mimeType|byteSize/i);
  });

  it("applies VAT/search filters and stable cursor pagination without widening visibility", async () => {
    const { listMarketplaceListings } = await import("./listings");
    await expect(listMarketplaceListings({ activeCompanyId: buyerCompany, limit: 0 }))
      .rejects.toMatchObject({ status: 400, code: "INVALID_PAGE_SIZE" });
    await expect(listMarketplaceListings({ activeCompanyId: buyerCompany, cursor: "forged" }))
      .rejects.toMatchObject({ status: 400, code: "INVALID_MARKETPLACE_CURSOR" });
    const first = await listMarketplaceListings({ activeCompanyId: buyerCompany, limit: 1 });
    expect(first.listings.map(({ id }) => id)).toEqual([listingIds.newest]);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await listMarketplaceListings({ activeCompanyId: buyerCompany, limit: 1, cursor: first.nextCursor! });
    expect(second.listings.map(({ id }) => id)).toEqual([listingIds.older]);
    expect((await listMarketplaceListings({ activeCompanyId: buyerCompany, search: "AAA" })).listings.map(({ id }) => id))
      .toEqual([listingIds.newest]);
    expect((await listMarketplaceListings({ activeCompanyId: buyerCompany, vat: "no" })).listings.map(({ id }) => id))
      .toEqual([listingIds.older]);
  });

  it("denies own, draft and withdrawn details and images while allowing another dealer's active image", async () => {
    const { getMarketplaceListing, readMarketplaceListingImage } = await import("./listings");
    await expect(getMarketplaceListing(buyerCompany, listingIds.own)).rejects.toMatchObject({ status: 404 });
    await expect(getMarketplaceListing(buyerCompany, listingIds.draft)).rejects.toMatchObject({ status: 404 });
    await expect(getMarketplaceListing(buyerCompany, listingIds.withdrawn)).rejects.toMatchObject({ status: 404 });
    await expect(readMarketplaceListingImage({ activeCompanyId: buyerCompany, listingId: listingIds.draft, position: 1 }))
      .rejects.toMatchObject({ status: 404 });
    await expect(readMarketplaceListingImage({ activeCompanyId: buyerCompany, listingId: listingIds.withdrawn, position: 1 }))
      .rejects.toMatchObject({ status: 404 });
    await expect(readMarketplaceListingImage({ activeCompanyId: buyerCompany, listingId: listingIds.own, position: 1 }))
      .rejects.toMatchObject({ status: 404 });
    await expect(readMarketplaceListingImage({ activeCompanyId: buyerCompany, listingId: listingIds.newest, position: 1 }))
      .resolves.toMatchObject({ mimeType: "image/jpeg", bytes: new Uint8Array([1]) });
  });

  it("excludes suspended and revoked memberships from freshly resolved company contexts", async () => {
    const { listActiveCompanyContexts } = await import("@/server/company/context");
    await expect(listActiveCompanyContexts(activeViewer)).resolves.toHaveLength(1);
    await expect(listActiveCompanyContexts(suspendedViewer)).resolves.toHaveLength(0);
    await expect(listActiveCompanyContexts(revokedViewer)).resolves.toHaveLength(0);
  });
});

function listing(
  id: string,
  sellerCompanyId: string,
  createdByUserId: string,
  status: "draft" | "active" | "withdrawn",
  registrationNumber: string,
  deductibleVat: boolean,
  publishedAt: Date | null,
) {
  return {
    id,
    sellerCompanyId,
    createdByUserId,
    inputKind: "registration" as const,
    registrationNumber,
    mileageKm: 64_300,
    shortComment: "Marketplace test",
    deductibleVat,
    status,
    publishedAt,
  };
}
