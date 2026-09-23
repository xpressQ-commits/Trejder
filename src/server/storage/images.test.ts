import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AccessError } from "@/server/security";
import {
  createLocalImageStorage,
  createPrivateObjectKey,
  MAX_IMAGE_BYTES,
  validateImage,
} from "./images";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 0, 0, 0, 0, 0,
  0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("private vehicle image validation", () => {
  it("accepts supported content when the claimed MIME matches", () => {
    expect(validateImage(jpeg, "image/jpeg")).toMatchObject({ mimeType: "image/jpeg", byteSize: 6 });
    expect(validateImage(png, "image/png")).toMatchObject({ mimeType: "image/png", byteSize: 24 });
  });

  it("rejects MIME spoofing and truncated signatures", () => {
    expect(() => validateImage(jpeg, "image/png")).toThrowError(AccessError);
    expect(() => validateImage(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg")).toThrowError(AccessError);
    expect(() => validateImage(new TextEncoder().encode("not-an-image"), "image/jpeg")).toThrowError(AccessError);
  });

  it("rejects oversized files", () => {
    expect(() => validateImage(new Uint8Array(MAX_IMAGE_BYTES + 1), "image/jpeg"))
      .toThrowError(expect.objectContaining({ code: "INVALID_IMAGE_SIZE" }));
  });

  it("creates non-enumerable, tenant-prefixed keys", () => {
    const first = createPrivateObjectKey("company-a", "listing-a", 1, "image/jpeg");
    const second = createPrivateObjectKey("company-a", "listing-a", 1, "image/jpeg");
    expect(first).toMatch(/^company-a\/listing-a\/1-[a-f0-9]{32}\.jpg$/);
    expect(second).not.toBe(first);
  });

  it("stores, reads and deletes local private objects without allowing path traversal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "handlarborsen-images-"));
    temporaryRoots.push(root);
    const storage = createLocalImageStorage(root);
    await storage.put("company/listing/1-test.jpg", jpeg, "image/jpeg");
    await expect(storage.read("company/listing/1-test.jpg").then((bytes) => Array.from(bytes)))
      .resolves.toEqual(Array.from(jpeg));
    await expect(storage.put("../escape.jpg", jpeg, "image/jpeg"))
      .rejects.toMatchObject({ code: "INVALID_STORAGE_KEY" });
    await storage.delete("company/listing/1-test.jpg");
    await expect(storage.read("company/listing/1-test.jpg")).rejects.toBeDefined();
  });
});
