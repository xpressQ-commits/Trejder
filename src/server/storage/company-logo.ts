import sharp from "sharp";

/** Remove empty white/transparent margins before fitting the agreement header. */
export async function optimizeCompanyLogo(source: Uint8Array) {
  const oriented = await sharp(source)
    .rotate()
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  return new Uint8Array(await sharp(oriented)
    .trim({ background: "#ffffff", threshold: 20 })
    .resize({ width: 720, height: 260, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer());
}
