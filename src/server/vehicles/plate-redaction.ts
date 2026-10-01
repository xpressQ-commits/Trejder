import sharp, { type Sharp } from "sharp";
import { z } from "zod";
import type { SupportedImageMime } from "@/server/storage/images";

export type PlateRedactionStatus =
  | "NOT_CHECKED"
  | "PROCESSING"
  | "NO_PLATE_DETECTED"
  | "PLATE_REDACTED"
  | "REVIEW_REQUIRED"
  | "FAILED";

export type PlateBox = { xmin: number; ymin: number; xmax: number; ymax: number };
export type PlateDetection = { box: PlateBox; confidence: number };

export interface PlateDetector {
  detect(bytes: Uint8Array, mimeType: SupportedImageMime): Promise<PlateDetection[]>;
}

type RedactionResult = {
  bytes: Uint8Array;
  mimeType: SupportedImageMime;
  status: PlateRedactionStatus;
  confidence: number | null;
  error: string | null;
};

const snapshotResponse = z.object({
  results: z.array(z.object({
    score: z.number().min(0).max(1),
    box: z.object({
      xmin: z.number().int().nonnegative(),
      ymin: z.number().int().nonnegative(),
      xmax: z.number().int().positive(),
      ymax: z.number().int().positive(),
    }),
  })),
});

class PlateRecognizerDetector implements PlateDetector {
  constructor(
    private readonly token: string,
    private readonly endpoint: string,
    private readonly timeoutMs: number,
  ) {}

  async detect(bytes: Uint8Array, mimeType: SupportedImageMime): Promise<PlateDetection[]> {
    const body = new FormData();
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    body.set("upload", new Blob([Buffer.from(bytes)], { type: mimeType }), `vehicle.${extension}`);
    body.append("regions", "se");
    body.append("regions", "eu");
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Token ${this.token}` },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`plate_provider_http_${response.status}`);
    const parsed = snapshotResponse.safeParse(await response.json());
    if (!parsed.success) throw new Error("plate_provider_invalid_response");
    return parsed.data.results.map((item) => ({ box: item.box, confidence: item.score }));
  }
}

let detectorOverride: PlateDetector | null | undefined;
export function setPlateDetector(detector: PlateDetector | null | undefined) {
  detectorOverride = detector;
}

export function getPlateDetector(): PlateDetector | null {
  if (detectorOverride !== undefined) return detectorOverride;
  const token = process.env.PLATE_RECOGNIZER_API_TOKEN?.trim();
  if (!token) return null;
  const timeout = Number(process.env.PLATE_RECOGNIZER_TIMEOUT_MS ?? 12_000);
  return new PlateRecognizerDetector(
    token,
    process.env.PLATE_RECOGNIZER_API_URL ?? "https://api.platerecognizer.com/v1/plate-reader/",
    Number.isFinite(timeout) && timeout > 0 ? timeout : 12_000,
  );
}

export async function redactVehicleImage(
  input: Uint8Array,
  mimeType: SupportedImageMime,
): Promise<RedactionResult> {
  const normalized = await normalize(input, mimeType);
  const detector = getPlateDetector();
  if (!detector) return makeResult(normalized, mimeType, "NOT_CHECKED", null, "provider_not_configured");
  try {
    const detections = await detector.detect(normalized, mimeType);
    if (detections.length === 0) return makeResult(normalized, mimeType, "NO_PLATE_DETECTED", null, null);
    const confidence = Math.min(...detections.map((item) => item.confidence));
    if (confidence < confidenceThreshold()) {
      return makeResult(normalized, mimeType, "REVIEW_REQUIRED", confidence, null);
    }
    const redacted = await blurBoxes(normalized, mimeType, detections.map((item) => item.box));
    return makeResult(redacted, mimeType, "PLATE_REDACTED", confidence, null);
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith("plate_provider_")
      ? error.message
      : "plate_processing_failed";
    return makeResult(normalized, mimeType, "FAILED", null, reason.slice(0, 120));
  }
}

function confidenceThreshold() {
  const configured = Number(process.env.PLATE_RECOGNIZER_CONFIDENCE ?? 0.75);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1 ? configured : 0.75;
}

function makeResult(bytes: Uint8Array, mimeType: SupportedImageMime, status: PlateRedactionStatus, confidence: number | null, error: string | null): RedactionResult {
  return { bytes, mimeType, status, confidence, error };
}

async function normalize(bytes: Uint8Array, mimeType: SupportedImageMime): Promise<Uint8Array> {
  const pipeline = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  return encode(pipeline, mimeType);
}

async function blurBoxes(bytes: Uint8Array, mimeType: SupportedImageMime, boxes: PlateBox[]) {
  const metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error("plate_processing_invalid_dimensions");
  const overlays: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const box of boxes) {
    const left = Math.max(0, Math.floor(box.xmin));
    const top = Math.max(0, Math.floor(box.ymin));
    const right = Math.min(width, Math.ceil(box.xmax));
    const bottom = Math.min(height, Math.ceil(box.ymax));
    if (right <= left || bottom <= top) throw new Error("plate_provider_invalid_box");
    const blurred = await sharp(bytes)
      .extract({ left, top, width: right - left, height: bottom - top })
      .blur(22)
      .toBuffer();
    overlays.push({ input: blurred, left, top });
  }
  return encode(sharp(bytes).composite(overlays), mimeType);
}

async function encode(pipeline: Sharp, mimeType: SupportedImageMime): Promise<Uint8Array> {
  if (mimeType === "image/jpeg") return pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  if (mimeType === "image/png") return pipeline.png({ compressionLevel: 9 }).toBuffer();
  return pipeline.webp({ quality: 88 }).toBuffer();
}
