import { describe, expect, it } from "vitest";
import { decodeMarketplaceCursor } from "./listings";

describe("marketplace cursor boundary", () => {
  it("accepts only an opaque cursor with the allow-listed shape", () => {
    const cursor = Buffer.from(JSON.stringify({
      publishedAt: "2026-09-28T10:00:00.000Z",
      id: "73f05083-5973-4eaa-a645-8dacefd702ee",
    })).toString("base64url");
    expect(decodeMarketplaceCursor(cursor)).toEqual({
      publishedAt: "2026-09-28T10:00:00.000Z",
      id: "73f05083-5973-4eaa-a645-8dacefd702ee",
    });
  });

  it.each(["not-base64-json", Buffer.from("{}").toString("base64url")])(
    "rejects manipulated cursors",
    (cursor) => expect(() => decodeMarketplaceCursor(cursor)).toThrowError(
      expect.objectContaining({ status: 400, code: "INVALID_MARKETPLACE_CURSOR" }),
    ),
  );
});
