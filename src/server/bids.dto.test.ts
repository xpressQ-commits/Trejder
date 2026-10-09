// @vitest-environment node

import { describe, expect, it } from "vitest";
import { toPublicBidActivity } from "./bids";

describe("public bid activity DTO", () => {
  it("counts unique anonymous bidders and exposes only alias and time", () => {
    const first = new Date("2026-10-09T12:32:00Z");
    const result = toPublicBidActivity([
      {
        anonymousNumber: 1,
        createdAt: first,
        bidderCompanyId: "secret-company-a",
        legalName: "Secret Dealer AB",
        amountOre: 67_600_000,
      } as { anonymousNumber: number; createdAt: Date },
      { anonymousNumber: 1, createdAt: new Date("2026-10-09T12:40:00Z") },
      { anonymousNumber: 2, createdAt: new Date("2026-10-09T12:41:00Z") },
    ]);

    expect(result).toEqual({
      bidderCount: 2,
      activity: [
        { anonymousLabel: "Handlare A", createdAt: first },
        {
          anonymousLabel: "Handlare B",
          createdAt: new Date("2026-10-09T12:41:00Z"),
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /secret-company|Secret Dealer|amountOre|companyId|userId/i,
    );
  });
});
