import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderImageVariant } from "./image-variants";

describe("renderImageVariant", () => {
  it("creates a bounded WebP thumbnail for an allowed width", async () => {
    const original = await sharp({
      create: { width: 1200, height: 900, channels: 3, background: "#336699" },
    })
      .jpeg()
      .toBuffer();
    const variant = await renderImageVariant(
      new Request("https://trejder.test/image?width=320"),
      new Uint8Array(original),
      "image/jpeg",
    );
    const metadata = await sharp(variant.bytes).metadata();
    expect(variant.mimeType).toBe("image/webp");
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(240);
    expect(variant.bytes.byteLength).toBeLessThan(original.byteLength);
  });

  it("leaves the original untouched for arbitrary widths", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const result = await renderImageVariant(
      new Request("https://trejder.test/image?width=777"),
      bytes,
      "image/jpeg",
    );
    expect(result).toEqual({ bytes, mimeType: "image/jpeg" });
  });
});
