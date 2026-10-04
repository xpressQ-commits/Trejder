import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { hasPermission } from "@/domain/authorization";
import { auditLog, company, companyMembership, platformAdmin, user, vehicleImage, vehicleListing } from "@/server/db/schema";
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
  const adminA = randomUUID();
  const superAdminA = randomUUID();
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
      { id: adminA, name: "Admin A", email: `${adminA}@example.test`, emailVerified: true },
      { id: superAdminA, name: "Superadmin A", email: `${superAdminA}@example.test`, emailVerified: true },
      { id: viewerA, name: "Viewer A", email: `${viewerA}@example.test`, emailVerified: true },
      { id: traderB, name: "Trader B", email: `${traderB}@example.test`, emailVerified: true },
    ]);
    await db.insert(company).values([
      { id: companyA, legalName: "Phase 2 A", organizationNumber: `A${randomUUID().slice(0, 12)}`, contactEmail: `${traderA}@example.test` },
      { id: companyB, legalName: "Phase 2 B", organizationNumber: `B${randomUUID().slice(0, 12)}`, contactEmail: `${traderB}@example.test` },
    ]);
    await db.insert(companyMembership).values([
      { companyId: companyA, userId: traderA, role: "trader" },
      { companyId: companyA, userId: adminA, role: "admin" },
      { companyId: companyA, userId: superAdminA, role: "admin" },
      { companyId: companyA, userId: viewerA, role: "viewer" },
      { companyId: companyB, userId: traderB, role: "trader" },
    ]);
    await db.insert(platformAdmin).values({ userId: superAdminA });
  });

  afterAll(async () => {
    setPlateDetector(undefined);
    if (!testDatabaseUrl) return;
    const { getDb } = await import("@/server/db");
    const db = getDb();
    await db.delete(auditLog).where(inArray(auditLog.actorCompanyId, [companyA, companyB]));
    await db.delete(vehicleListing).where(inArray(vehicleListing.sellerCompanyId, [companyA, companyB]));
    await db.delete(platformAdmin).where(eq(platformAdmin.userId, superAdminA));
    await db.delete(companyMembership).where(inArray(companyMembership.companyId, [companyA, companyB]));
    await db.delete(company).where(inArray(company.id, [companyA, companyB]));
    await db.delete(user).where(inArray(user.id, [traderA, adminA, superAdminA, viewerA, traderB]));
  });

  it("keeps Company B drafts unreadable and immutable to Company A", async () => {
    const { createDraft, deleteDraft, getOwnListing, updateOwnListing } = await import("./listings");
    const draft = await createDraft({ companyId: companyB, actorUserId: traderB, values: values(1200) });
    await expect(getOwnListing(companyA, draft.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateOwnListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA, values: { shortComment: "Intrång" } }))
      .rejects.toMatchObject({ status: 404 });
    await expect(deleteDraft({ companyId: companyA, listingId: draft.id, actorUserId: traderA }))
      .rejects.toMatchObject({ status: 404 });
  });

  it("deletes only drafts and removes their private images", async () => {
    const { createDraft, deleteDraft, getOwnListing, publishListing, putListingImage } = await import("./listings");
    const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(1300) });
    const withImage = await putListingImage({ companyId: companyA, listingId: draft.id, actorUserId: traderA, position: 1, claimedMime: "image/jpeg", bytes: jpeg });
    expect(storage.objects.size).toBeGreaterThan(0);
    await deleteDraft({ companyId: companyA, listingId: draft.id, actorUserId: traderA });
    await expect(getOwnListing(companyA, draft.id)).rejects.toMatchObject({ status: 404 });
    expect(storage.objects.size).toBe(0);

    const active = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(1301) });
    await putListingImage({ companyId: companyA, listingId: active.id, actorUserId: traderA, position: 1, claimedMime: "image/jpeg", bytes: jpeg });
    await publishListing({ companyId: companyA, listingId: active.id, actorUserId: traderA });
    await expect(deleteDraft({ companyId: companyA, listingId: active.id, actorUserId: traderA }))
      .rejects.toMatchObject({ code: "DRAFT_DELETE_ONLY" });
    expect(withImage.images).toHaveLength(1);
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

  it("publishes with one image, accepts five, and rejects a sixth position", async () => {
    const { createDraft, publishListing, putListingImage } = await import("./listings");
    const oneImageDraft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(3000) });
    await expect(publishListing({ companyId: companyA, listingId: oneImageDraft.id, actorUserId: traderA }))
      .rejects.toMatchObject({ code: "IMAGE_COUNT_REQUIRED" });
    await putListingImage({ companyId: companyA, listingId: oneImageDraft.id, actorUserId: traderA, position: 1, claimedMime: "image/jpeg", bytes: jpeg });
    await expect(publishListing({ companyId: companyA, listingId: oneImageDraft.id, actorUserId: traderA }))
      .resolves.toMatchObject({ status: "active", images: { length: 1 } });

    const fiveImageDraft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(3001) });
    for (const position of [1, 2, 3, 4, 5] as const) {
      await putListingImage({ companyId: companyA, listingId: fiveImageDraft.id, actorUserId: traderA, position, claimedMime: "image/jpeg", bytes: jpeg });
    }
    await expect(publishListing({ companyId: companyA, listingId: fiveImageDraft.id, actorUserId: traderA }))
      .resolves.toMatchObject({ status: "active", images: { length: 5 } });
    const { updateOwnListing } = await import("./listings");
    await expect(updateOwnListing({
      companyId: companyA,
      listingId: fiveImageDraft.id,
      actorUserId: traderA,
      values: { mileageMil: 1 },
    })).rejects.toMatchObject({ code: "ACTIVE_LISTING_FIELDS_LOCKED" });
    await expect(putListingImage({ companyId: companyA, listingId: fiveImageDraft.id, actorUserId: traderA, position: 6, claimedMime: "image/jpeg", bytes: jpeg }))
      .rejects.toMatchObject({ code: "INVALID_IMAGE_POSITION" });
  });

  it("allows a company admin and a dual-authority platform superadmin to publish", async () => {
    expect(hasPermission("admin", "listing:mutate")).toBe(true);
    expect(hasPermission("viewer", "listing:mutate")).toBe(false);
    const { createDraft, publishListing, putListingImage } = await import("./listings");
    for (const actorUserId of [adminA, superAdminA]) {
      const draft = await createDraft({ companyId: companyA, actorUserId, values: values(actorUserId === adminA ? 2100 : 2200) });
      await putListingImage({ companyId: companyA, listingId: draft.id, actorUserId, position: 1, claimedMime: "image/jpeg", bytes: jpeg });
      await expect(publishListing({ companyId: companyA, listingId: draft.id, actorUserId }))
        .resolves.toMatchObject({ status: "active", images: { length: 1 } });
    }
  });

  it("does not block publication when plate redaction is not configured", async () => {
    const previousRequired = process.env.PLATE_REDACTION_REQUIRED;
    const previousToken = process.env.PLATE_RECOGNIZER_API_TOKEN;
    delete process.env.PLATE_REDACTION_REQUIRED;
    delete process.env.PLATE_RECOGNIZER_API_TOKEN;
    setPlateDetector(null);
    try {
      const { createDraft, publishListing, putListingImage } = await import("./listings");
      const draft = await createDraft({ companyId: companyA, actorUserId: traderA, values: values(3100) });
      const uploaded = await putListingImage({ companyId: companyA, listingId: draft.id, actorUserId: traderA, position: 1, claimedMime: "image/jpeg", bytes: jpeg });
      expect(uploaded.images[0].plateRedactionStatus).toBe("NOT_CHECKED");
      await expect(publishListing({ companyId: companyA, listingId: draft.id, actorUserId: traderA }))
        .resolves.toMatchObject({ status: "active" });
    } finally {
      if (previousRequired === undefined) delete process.env.PLATE_REDACTION_REQUIRED;
      else process.env.PLATE_REDACTION_REQUIRED = previousRequired;
      if (previousToken === undefined) delete process.env.PLATE_RECOGNIZER_API_TOKEN;
      else process.env.PLATE_RECOGNIZER_API_TOKEN = previousToken;
      setPlateDetector({ detect: async () => [] });
    }
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
    identifier: { kind: "model" as const, value: `Testbil ${mileageMil}` },
    modelYear: 2026,
    mileageMil,
    shortComment: "Integrationstest",
    deductibleVat: false,
  };
}
