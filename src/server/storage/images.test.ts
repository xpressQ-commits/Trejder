import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "@/server/security";
import {
  createLocalImageStorage,
  createPrivateObjectKey,
  getImageStorage,
  isTransientStorageError,
  MAX_IMAGE_BYTES,
  storageErrorLogFields,
  validateImage,
  withTransientStorageRetry,
} from "./images";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 0, 0, 0, 0, 0,
  0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
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

  it("creates opaque, non-enumerable keys without tenant or listing identifiers", () => {
    const first = createPrivateObjectKey("image/jpeg");
    const second = createPrivateObjectKey("image/jpeg");
    expect(first).toMatch(/^private\/[a-f0-9]{64}\.jpg$/);
    expect(first).not.toContain("company-a");
    expect(first).not.toContain("listing-a");
    expect(second).not.toBe(first);
  });

  it("fails closed in production when private R2 storage is incomplete", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("R2_ENDPOINT", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    vi.stubEnv("R2_BUCKET", "");
    expect(() => getImageStorage()).toThrowError("R2 private storage is not fully configured");
  });

  it("stores, reads and deletes local private objects without allowing path traversal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "trejder-images-"));
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

  it("retries transient TLS failures before succeeding", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("TLS handshake failed"), { code: "EPROTO" }))
      .mockResolvedValue("stored");
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(withTransientStorageRetry(operation, wait)).resolves.toBe("stored");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(200);
    expect(isTransientStorageError({ code: "EPROTO" })).toBe(true);
  });

  it("does not retry non-transient storage failures", async () => {
    const operation = vi.fn().mockRejectedValue(Object.assign(new Error("Denied"), { code: "AccessDenied" }));
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(withTransientStorageRetry(operation, wait)).rejects.toMatchObject({ code: "AccessDenied" });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("reports safe AWS storage diagnostics without logging secrets or messages", () => {
    const error = Object.assign(new Error("request to a private endpoint failed"), {
      name: "Unknown",
      code: "EPROTO",
      secretAccessKey: "must-not-be-logged",
      $metadata: { httpStatusCode: 400, attempts: 2, totalRetryDelay: 200 },
    });

    expect(storageErrorLogFields(error)).toEqual({
      name: "Unknown",
      code: "EPROTO",
      httpStatusCode: 400,
      attempts: 2,
      totalRetryDelay: 200,
    });
    expect(storageErrorLogFields(error)).not.toHaveProperty("message");
    expect(storageErrorLogFields(error)).not.toHaveProperty("secretAccessKey");
  });
});
