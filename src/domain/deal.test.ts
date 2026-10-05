import { describe, expect, it } from "vitest";
import { confirmDealParty } from "./deal";

describe("deal completion", () => {
  it("requires both parties before completing a deal", () => {
    const sellerAt = new Date("2026-10-05T10:00:00Z");
    const buyerAt = new Date("2026-10-05T11:00:00Z");
    const first = confirmDealParty({
      viewerIsSeller: true,
      sellerCompletedAt: null,
      buyerCompletedAt: null,
      now: sellerAt,
    });
    expect(first).toMatchObject({
      status: "in_progress",
      sellerCompletedAt: sellerAt,
      buyerCompletedAt: null,
      completedAt: null,
    });
    const second = confirmDealParty({
      viewerIsSeller: false,
      sellerCompletedAt: first.sellerCompletedAt,
      buyerCompletedAt: first.buyerCompletedAt,
      now: buyerAt,
    });
    expect(second).toMatchObject({
      status: "completed",
      sellerCompletedAt: sellerAt,
      buyerCompletedAt: buyerAt,
      completedAt: buyerAt,
    });
  });

  it("keeps a party confirmation idempotent", () => {
    const original = new Date("2026-10-05T10:00:00Z");
    const retry = confirmDealParty({
      viewerIsSeller: true,
      sellerCompletedAt: original,
      buyerCompletedAt: null,
      now: new Date("2026-10-05T12:00:00Z"),
    });
    expect(retry.sellerCompletedAt).toBe(original);
  });
});
