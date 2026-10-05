import sharp from "sharp";

const ALLOWED_WIDTHS = new Set([320, 640, 960, 1280]);

export async function renderImageVariant(
  request: Request,
  bytes: Uint8Array,
  mimeType: string,
) {
  const requested = Number(new URL(request.url).searchParams.get("width"));
  if (!ALLOWED_WIDTHS.has(requested)) return { bytes, mimeType };
  const output = await sharp(bytes)
    .rotate()
    .resize({ width: requested, withoutEnlargement: true, fit: "inside" })
    .webp({ quality: 78 })
    .toBuffer();
  return { bytes: new Uint8Array(output), mimeType: "image/webp" };
}
