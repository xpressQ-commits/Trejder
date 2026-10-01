import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { hasPermission } from "@/domain/authorization";
import { auditLog, company, companyMembership, user, vehicleImage, vehicleListing } from "@/server/db/schema";
import { setImageStorage, type PrivateImageStorage, type SupportedImageMime } from "@/server/storage/images";
import { setPlateDetector } from "@/server/vehicles/plate-redaction";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(testDatabaseUrl));

class MemoryStorage implements PrivateImageStorage {
  objects = new Map<string, Uint8Array>();
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

integration("Phase 2 PostgreSQL listing isolation and lifecycle", () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const traderA = randomUUID();
  const viewerA = randomUUID();
  const traderB = randomUUID();
  const storage = new MemoryStorage();
  let jpeg: Uint8Array;

  beforeAll(async () => {
    jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).jpeg().toBuffer();
    setPlateDetector({ detect: async () => [] });
    process.env.DATABASE_URL = testDatabaseUrl;
    setImageStorage(storage);
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.insert(user).values([
      { id: traderA, name: "Trader A", email: `${traderA}@example.test`, emailVerified: true },
      { id: viewerA, name: "Viewer A", email: `${viewerA}@example.test`, emailVerified: true },
      { id: traderB, name: "Trader B", email: `${traderB}@example.test`, emailVerified: true },
    ]);
    await db.insert(company).values([
      { id: companyA, legalName: "Phase 2 A", organizationNumber: `A${randomUUID().slice(0, 12)}`, contactEmail: `${traderA}@example.test` },
      { id: companyB, legalName: "Phase 2 B", organizationNumber: `B${randomUUID().slice(0, 12)}`, contactEmail: `${traderB}@example.test` },
    ]);
    await db.insert(companyMembership).values([
      { companyId: companyA, userId: traderA, role: "trader" },
      { companyId: companyA, userId: viewerA, role: "viewer" },
      { companyId: companyB, userId: traderB, role: "trader" },
    ]);
  });

  afterAll(async () => {
    setPlateDetector(undefined);
    if (!testDatabaseUrl) return;
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.delete(auditLog).where(inArray(auditLog.actorCompanyId, [companyA, companyB]));
    await db.delete(vehicleListing).where(inArray(vehicleListing.sellerCompanyId, [companyA, companyB]));
    await db.delete(companyMembership).where(inArray(companyMembership.companyId, [companyA, companyB]));
    await db.delete(company).where(inArray(company.id, [companyA, companyB]));
    await db.delete(user).where(inArray(user.id, [traderA, viewerA, traderB]));
  });

  it("keeps Company B drafts unreadable and immutable to Company A", async () => {
    const { createDraft, getOwnListing, updateOwnListing } = await import("./listings");
    const draft = await createDraft({ companyId: companyB, actorUserId: traderB, values: values(1200) });
    await expect(getOwnListing(companyA, draft.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateOwnListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA, values: { shortComment: "Intrång" } }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("keeps VIEWER read-only while TRADER can create and edit a draft", async () => {
    expect(hasPermission("viewer", "listing:mutate")).toBe(false);
    expect(hasPermission("trader", "listing:mutate")).toBe(true);
    const { createDraft, updateOwnListing } = await import("./listings");
    const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(6430) });
    await expect(updateOwnListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA, values: { shortComment: "Korrigerad" } }))
      .resolves.toMatchObject({ shortComment: "Korrigerad" });
  });

  it("normalizes mileage on the server and never accepts a normalized-km field", async () => {
    const { createDraft } = await import("./listings");
    const { getDb } = await import("@/server/db");
    const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(6430) });
    const [row] = await getDb().select({ mileageKm: vehicleListing.mileageKm })
      .from(vehicleListing).where(eq(vehicleListing.id, draft.id));
    expect(row.mileageKm).toBe(64_300);
    expect(draft).not.toHaveProperty("mileageKm");
  });

  it("requires at least 3 images, accepts 5, and rejects a sixth position", async () => {
    const { createDraft, publishListing, putListingImage } = await import("./listings");
    const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(3000) });
    await expect(publishListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA }))
      .rejects.toMatchObject({ code: "IMAGE_COUNT_REQUIRED" });
    for (const position of [1, 2] as const) {
      await putListingImage({ companyId: companyA, listingId: draft.id, actorUserId: traderA, position, claimedMime: "image/jpeg", bytes: jpeg });
      await expect(publishListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA }))
        .rejects.toMatchObject({ code: "IMAGE_COUNT_REQUIRED" });
    }
    for (const position of [3, 4, 5] as const) {
      await putListingImage({ companyId: companyA, listingId: draft.id, actorUserId: traderA, position, claimedMime: "image/jpeg", bytes: jpeg });
    }
    await expect(publishListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA }))
      .resolves.toMatchObject({ status: "active", images: { length: 5 } });
    const { updateOwnListing } = await import("./listings");
    await expect(updateOwnListing({
      companyId: companyA,
      listingId: draft.id,
      actorUserId: traderA,
      values: { mileageMil: 1 },
    })).rejects.toMatchObject({ code: "ACTIVE_LISTING_FIELDS_LOCKED" });
    await expect(putListingImage({ companyId: companyA, listingId: draft.id, actorUserId: traderA, position: 6, claimedMime: "image/jpeg", bytes: jpeg }))
      .rejects.toMatchObject({ code: "INVALID_IMAGE_POSITION" });
  });

  it("enforces duplicate image positions in PostgreSQL", async () => {
    const { createDraft } = await import("./listings");
    const { getDb } = await import("@/server/db");
    const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(4000) });
    await getDb().insert(vehicleImage).values({ listingId: draft.id, position: 1, objectKey: randomUUID(), mimeType: "image/jpeg", byteSize: 6, checksumSha256: "a".repeat(64), sourceChecksumSha256: "a".repeat(64) });
    await expect(getDb().insert(vehicleImage).values({ listingId: draft.id, position: 1, objectKey: randomUUID(), mimeType: "image/jpeg", byteSize: 6, checksumSha256: "b".repeat(64), sourceChecksumSha256: "b".repeat(64) }))
      .rejects.toMatchObject({ code: "23505" });
  });

  it("cannot attach or remove an image through another company", async () => {
    const { createDraft, putListingImage, removeListingImage } = await import("./listings");
    const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(5000) });
    await putListingImage({ companyId: companyA, listingId: draft.id, actorUserId: traderA, position: 1, claimedMime: "image/jpeg", bytes: jpeg });
    await expect(putListingImage({ companyId: companyB, listingId: draft.id, actorUserId: traderB, position: 2, claimedMime: "image/jpeg", bytes: jpeg }))
      .rejects.toMatchObject({ status: 404 });
    await expect(removeListingImage({ companyId: companyB, listingId: draft.id, actorUserId: traderB, position: 1 }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("makes withdrawal terminal and locks active identity fields", async () => {
    const { createDraft, updateOwnListing, withdrawListing } = await import("./listings");
    const withdrawn = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(6000) });
    await withdrawListing({ companyId: companyA, listingId: withdrawn.id, actorUserId: traderA });
    await expect(updateOwnListing({ companyId: companyA, listingId: withdrawn.id, actorUserId: traderA, values: { shortComment: "No" } }))
      .rejects.toMatchObject({ code: "LISTING_NOT_EDITABLE" });
  });

  it("serializes concurrent publication and writes one publish audit", async () => {
    const { createDraft, publishListing, putListingImage } = await import("./listings");
    const { getDb } = await import("@/server/db");
    const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(7000) });
    for (const position of [1, 2, 3] as const) {
      await putListingImage({ companyId: companyA, listingId: draft.id, actorUserId: traderA, position, claimedMime: "image/jpeg", bytes: jpeg });
    }
    const results = await Promise.all([
      publishListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA }),
      publishListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA }),
    ]);
    expect(results.every((result) => result.status === "active")).toBe(true);
    const [events] = await getDb().select({ value: count() }).from(auditLog).where(and(
      eq(auditLog.aggregateId, draft.id),
      eq(auditLog.action, "vehicle_listing.published"),
    ));
    expect(events.value).toBe(1);
  });
});

function values(mileageMil: number) {
  return {
    identifier: { kind: "registration" as const, value: `T${String(mileageMil).padStart(5, "0")}` },
    mileageMil,
    shortComment: "Integrationstest",
    deductibleVat: false,
  };
}
