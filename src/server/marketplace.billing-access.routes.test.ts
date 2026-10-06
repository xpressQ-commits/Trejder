// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "./security";

const listingId = "22222222-2222-4222-8222-222222222222";
const companyId = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  requireDealerMembershipPermission: vi.fn(),
  requireDealerPermission: vi.fn(),
  getOwnBid: vi.fn(),
  placeBid: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: companyId })),
  })),
}));
vi.mock("@/server/company/context", () => ({
  ACTIVE_COMPANY_COOKIE: "trejder_company",
  requireDealerMembershipPermission: mocks.requireDealerMembershipPermission,
  requireDealerPermission: mocks.requireDealerPermission,
}));
vi.mock("@/server/bids", () => ({
  getOwnBid: mocks.getOwnBid,
  placeBid: mocks.placeBid,
}));

import { GET, POST } from "@/app/api/marketplace/[listingId]/bids/route";

const route = { params: Promise.resolve({ listingId }) };
const previousBaseUrl = process.env.BETTER_AUTH_URL;

describe("unpaid marketplace access boundary", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = "https://trejder.example";
    const context = {
      company: { id: companyId },
      membership: { role: "trader" },
      user: { id: "dealer-user" },
    };
    mocks.requireDealerMembershipPermission.mockResolvedValue(context);
    mocks.requireDealerPermission.mockResolvedValue(context);
    mocks.getOwnBid.mockResolvedValue(null);
    mocks.placeBid.mockResolvedValue({ id: "bid-id" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (previousBaseUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previousBaseUrl;
  });

  it("allows an active unpaid membership to read marketplace bid state", async () => {
    const response = await GET(
      new Request(`https://trejder.example/api/marketplace/${listingId}/bids`),
      route,
    );

    expect(response.status).toBe(200);
    expect(mocks.requireDealerMembershipPermission).toHaveBeenCalledWith(
      expect.any(Headers),
      companyId,
      "bid:read",
    );
    expect(mocks.requireDealerPermission).not.toHaveBeenCalled();
  });

  it("denies bidding when the server reports that a subscription is required", async () => {
    mocks.requireDealerPermission.mockRejectedValueOnce(
      new AccessError(403, "SUBSCRIPTION_REQUIRED"),
    );
    const response = await POST(
      new Request(`https://trejder.example/api/marketplace/${listingId}/bids`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://trejder.example",
        },
        body: JSON.stringify({ amountOre: 10_000_000 }),
      }),
      route,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "SUBSCRIPTION_REQUIRED" });
    expect(mocks.placeBid).not.toHaveBeenCalled();
  });

  it("uses the server-selected company when an eligible dealer bids", async () => {
    const response = await POST(
      new Request(`https://trejder.example/api/marketplace/${listingId}/bids`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://trejder.example",
        },
        body: JSON.stringify({ amountOre: 10_000_000 }),
      }),
      route,
    );

    expect(response.status).toBe(201);
    expect(mocks.placeBid).toHaveBeenCalledWith({
      listingId,
      bidderCompanyId: companyId,
      actorUserId: "dealer-user",
      amountOre: 10_000_000,
    });
  });
});
