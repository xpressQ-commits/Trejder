import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { AccessError } from "@/server/security";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const supported = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageMime = (typeof supported)[number];

export interface PrivateImageStorage {
  put(key: string, bytes: Uint8Array, mimeType: SupportedImageMime): Promise<void>;
  delete(key: string): Promise<void>;
  read(key: string): Promise<Uint8Array>;
}

const transientStorageCodes = new Set([
  "EAI_AGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENETUNREACH",
  "EPIPE",
  "EPROTO",
  "ETIMEDOUT",
]);

function storageErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return {};
  return error as {
    code?: string;
    name?: string;
    $metadata?: {
      httpStatusCode?: number;
      attempts?: number;
      totalRetryDelay?: number;
    };
  };
}

export function storageErrorLogFields(error: unknown) {
  const details = storageErrorDetails(error);
  return {
    name: details.name ?? "Unknown",
    code: details.code ?? "UNKNOWN",
    httpStatusCode: details.$metadata?.httpStatusCode,
    attempts: details.$metadata?.attempts,
    totalRetryDelay: details.$metadata?.totalRetryDelay,
  };
}

export function isTransientStorageError(error: unknown) {
  const details = storageErrorDetails(error);
  const status = details.$metadata?.httpStatusCode;
  return Boolean(
    (details.code && transientStorageCodes.has(details.code))
    || details.name === "TimeoutError"
    || details.name === "RequestTimeout"
    || (status && (status === 408 || status === 429 || status >= 500)),
  );
}

export async function withTransientStorageRetry<T>(
  operation: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  const delays = [200, 600, 1_500];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= delays.length || !isTransientStorageError(error)) throw error;
      await wait(delays[attempt]);
    }
  }
}

export function validateImage(bytes: Uint8Array, claimedMime: string) {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new AccessError(400, "INVALID_IMAGE_SIZE");
  let detected: SupportedImageMime | undefined;
  const text = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  const jpeg = bytes.length >= 6
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  const pngEnd = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  const png = bytes.length >= 24
    && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, i) => bytes[i] === value)
    && pngEnd.every((value, i) => bytes[bytes.length - pngEnd.length + i] === value);
  const riffSize = bytes.length >= 12
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true)
    : -1;
  const webpChunk = text(12, 16);
  const webp = bytes.length >= 16 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP"
    && riffSize === bytes.length - 8 && ["VP8 ", "VP8L", "VP8X"].includes(webpChunk);
  if (jpeg) detected = "image/jpeg";
  else if (png) detected = "image/png";
  else if (webp) detected = "image/webp";
  if (!detected || detected !== claimedMime || !supported.includes(detected)) throw new AccessError(400, "INVALID_IMAGE_TYPE");
  return { mimeType: detected, byteSize: bytes.length, checksumSha256: createHash("sha256").update(bytes).digest("hex") };
}

export function createPrivateObjectKey(mime: SupportedImageMime): string {
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  return `private/${randomBytes(32).toString("hex")}.${ext}`;
}

class LocalPrivateStorage implements PrivateImageStorage {
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    const resolved = path.resolve(this.root, key);
    const root = path.resolve(this.root) + path.sep;
    if (!resolved.startsWith(root)) throw new AccessError(400, "INVALID_STORAGE_KEY");
    return resolved;
  }
  async put(key: string, bytes: Uint8Array) { const file = this.resolve(key); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes, { flag: "wx" }); }
  async delete(key: string) { await rm(this.resolve(key), { force: true }); }
  async read(key: string) { return readFile(this.resolve(key)); }
}

export function createLocalImageStorage(root: string): PrivateImageStorage {
  return new LocalPrivateStorage(root);
}

class R2PrivateStorage implements PrivateImageStorage {
  private readonly client: S3Client;

  constructor(
    endpoint: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(key: string, bytes: Uint8Array, mimeType: SupportedImageMime) {
    await withTransientStorageRetry(() => this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: bytes,
      ContentType: mimeType,
      CacheControl: "private, no-store",
    })));
  }

  async delete(key: string) {
    await withTransientStorageRetry(() => this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })));
  }

  async read(key: string) {
    const result = await withTransientStorageRetry(() => this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })));
    if (!result.Body) throw new Error("Private image object is empty");
    return result.Body.transformToByteArray();
  }
}

let override: PrivateImageStorage | undefined;
export function setImageStorage(storage: PrivateImageStorage) { override = storage; }
export function getImageStorage(): PrivateImageStorage {
  if (override) return override;
  if (process.env.NODE_ENV === "production") {
    const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
      throw new Error("R2 private storage is not fully configured");
    }
    return new R2PrivateStorage(R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET);
  }
  return createLocalImageStorage(process.env.LOCAL_IMAGE_STORAGE_ROOT ?? path.join(process.cwd(), ".data", "vehicle-images"));
}
