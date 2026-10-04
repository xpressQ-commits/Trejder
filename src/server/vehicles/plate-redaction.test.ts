import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { redactVehicleImage, setPlateDetector, type PlateDetector } from "./plate-redaction";

let source: Uint8Array;

beforeAll(async () => {
  source = await sharp({
    create: { width: 240, height: 140, channels: 3, background: "#72777d" },
  }).composite([{
    input: Buffer.from('<svg width="120" height="36"><rect width="120" height="36" fill="white"/><text x="8" y="26" font-size="24" fill="black">ABC123</text></svg>'),
    left: 60,
    top: 70,
  }]).jpeg().toBuffer();
});

afterEach(() => {
  setPlateDetector(undefined);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("vehicle plate redaction", () => {
  it("returns a locally blurred image for a confident plate bounding box", async () => {
    setPlateDetector(detector([{ box: { xmin: 60, ymin: 70, xmax: 180, ymax: 106 }, confidence: 0.96 }]));
    const output = await redactVehicleImage(source, "image/jpeg");
    expect(output.status).toBe("PLATE_REDACTED");
    expect(output.confidence).toBe(0.96);
    expect(Buffer.from(output.bytes).equals(Buffer.from(source))).toBe(false);
  });

  it("reports when no plate is detected without claiming redaction", async () => {
    setPlateDetector(detector([]));
    await expect(redactVehicleImage(source, "image/jpeg"))
      .resolves.toMatchObject({ status: "NO_PLATE_DETECTED", confidence: null });
  });

  it("requires review below the confidence threshold", async () => {
    setPlateDetector(detector([{ box: { xmin: 60, ymin: 70, xmax: 180, ymax: 106 }, confidence: 0.4 }]));
    await expect(redactVehicleImage(source, "image/jpeg"))
      .resolves.toMatchObject({ status: "REVIEW_REQUIRED", confidence: 0.4 });
  });

  it("fails safely when the provider errors", async () => {
    setPlateDetector({ detect: async () => { throw new Error("network"); } });
    await expect(redactVehicleImage(source, "image/jpeg"))
      .resolves.toMatchObject({ status: "FAILED", error: "plate_processing_failed" });
  });

  it("stays not checked when no provider is configured", async () => {
    setPlateDetector(null);
    await expect(redactVehicleImage(source, "image/jpeg"))
      .resolves.toMatchObject({ status: "NOT_CHECKED", error: "provider_not_configured" });
  });

  it("retries a throttled provider response before failing the image", async () => {
    vi.stubEnv("PLATE_RECOGNIZER_API_TOKEN", "configured-token");
    setPlateDetector(undefined);
    const provider = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(Response.json({ results: [] }));
    vi.stubGlobal("fetch", provider);

    await expect(redactVehicleImage(source, "image/jpeg"))
      .resolves.toMatchObject({ status: "NO_PLATE_DETECTED", error: null });
    expect(provider).toHaveBeenCalledTimes(2);
  });
});

function detector(result: Awaited<ReturnType<PlateDetector["detect"]>>): PlateDetector {
  return { detect: async () => result };
}
