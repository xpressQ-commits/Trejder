// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ syncPendingSeatQuantities: vi.fn() }));
vi.mock("@/server/stripe", () => ({
  syncPendingSeatQuantities: mocks.syncPendingSeatQuantities,
}));

import { POST } from "@/app/api/internal/billing/seat-sync/route";

const previousSecret = process.env.BILLING_SYNC_SECRET;
const secret = "trejder-worker-secret-at-least-32-characters";

function request(authorization?: string) {
  return new Request("https://trejder.example/api/internal/billing/seat-sync", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("seat synchronization worker authorization", () => {
  beforeEach(() => {
    process.env.BILLING_SYNC_SECRET = secret;
    mocks.syncPendingSeatQuantities.mockResolvedValue({ processed: 2 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (previousSecret === undefined) delete process.env.BILLING_SYNC_SECRET;
    else process.env.BILLING_SYNC_SECRET = previousSecret;
  });

  it.each([
    ["missing", undefined],
    ["wrong scheme", `Basic ${secret}`],
    ["wrong secret", "Bearer attacker-secret"],
  ])("rejects %s worker credentials", async (_label, authorization) => {
    const response = await POST(request(authorization));

    expect(response.status).toBe(401);
    expect(mocks.syncPendingSeatQuantities).not.toHaveBeenCalled();
  });

  it("fails closed when the configured secret is missing or too short", async () => {
    process.env.BILLING_SYNC_SECRET = "short";

    const response = await POST(request("Bearer short"));

    expect(response.status).toBe(401);
    expect(mocks.syncPendingSeatQuantities).not.toHaveBeenCalled();
  });

  it("runs a bounded synchronization pass for the exact bearer secret", async () => {
    const response = await POST(request(`Bearer ${secret}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 2 });
    expect(mocks.syncPendingSeatQuantities).toHaveBeenCalledTimes(1);
  });
});
