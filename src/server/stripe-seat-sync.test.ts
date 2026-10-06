// @vitest-environment node

import { describe, expect, it } from "vitest";
import { seatSyncIdempotencyKey } from "./stripe";

describe("Stripe seat synchronization idempotency", () => {
  it("keeps the same key for retries of one persisted generation", () => {
    const first = seatSyncIdempotencyKey("company-a", 7, 3, false);
    const retry = seatSyncIdempotencyKey("company-a", 7, 3, false);

    expect(retry).toBe(first);
  });

  it("rotates the key for a new membership generation even when quantity returns to an old value", () => {
    expect(seatSyncIdempotencyKey("company-a", 7, 1, false))
      .not.toBe(seatSyncIdempotencyKey("company-a", 8, 1, false));
  });

  it("separates create-item and update-item operations", () => {
    expect(seatSyncIdempotencyKey("company-a", 7, 1, true))
      .not.toBe(seatSyncIdempotencyKey("company-a", 7, 1, false));
  });
});
