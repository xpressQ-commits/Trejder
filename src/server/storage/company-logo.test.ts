// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { optimizeCompanyLogo } from "./company-logo";

describe("company logo margins", () => {
  it.each(["#ffffff", { r: 255, g: 255, b: 255, alpha: 0 }])(
    "removes white and transparent margins without distorting the logo",
    async (background) => {
      const mark = await sharp({ create: {
        width: 300, height: 100, channels: 4, background: "#155e50",
      } }).png().toBuffer();
      const source = await sharp({ create: {
        width: 1000, height: 1000, channels: 4, background,
      } }).composite([{ input: mark, left: 350, top: 450 }]).png().toBuffer();
      const result = await optimizeCompanyLogo(source);
      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(300);
      expect(metadata.height).toBe(100);
      expect(metadata.format).toBe("png");
    },
  );
});
