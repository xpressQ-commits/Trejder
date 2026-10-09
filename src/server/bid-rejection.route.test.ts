// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "./security";

const listingId = "11111111-1111-4111-8111-111111111111";
const bidId = "22222222-2222-4222-8222-222222222222";
const sellerCompanyId = "33333333-3333-4333-8333-333333333333";
const mocks = vi.hoisted(() => ({
  requireCompanyPermission: vi.fn(),
  rejectBid: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: sellerCompanyId })),
  })),
}));
vi.mock("@/server/company/context", () => ({
  ACTIVE_COMPANY_COOKIE: "trejder_company",
  requireCompanyPermission: mocks.requireCompanyPermission,
}));
vi.mock("@/server/bids", () => ({ rejectBid: mocks.rejectBid }));

import { POST } from "@/app/api/company/listings/[listingId]/bids/[bidId]/reject/route";

const route = { params: Promise.resolve({ listingId, bidId }) };
const previousBaseUrl = process.env.BETTER_AUTH_URL;
function request(body: object) {
  return new Request(
    `https://trejder.example/api/company/listings/${listingId}/bids/${bidId}/reject`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://trejder.example",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("bid rejection route boundary", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = "https://trejder.example";
    vi.clearAllMocks();
    mocks.requireCompanyPermission.mockResolvedValue({
      company: { id: sellerCompanyId },
      user: { id: "seller-user" },
    });
    mocks.rejectBid.mockResolvedValue({ id: bidId, status: "rejected" });
  });

  afterEach(() => {
    if (previousBaseUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previousBaseUrl;
  });

  it("uses only the authenticated seller company and requires explicit confirmation", async () => {
    const response = await POST(request({ rejectionConfirmed: true }), route);
    expect(response.status).toBe(200);
    expect(mocks.rejectBid).toHaveBeenCalledWith({
      listingId,
      bidId,
      sellerCompanyId,
      actorUserId: "seller-user",
    });
  });

  it("rejects forged identifiers and unconfirmed requests before mutation", async () => {
    const response = await POST(
      request({ rejectionConfirmed: false, sellerCompanyId: "forged" }),
      route,
    );
    expect(response.status).toBe(400);
    expect(mocks.rejectBid).not.toHaveBeenCalled();
  });

  it("does not permit a buyer without seller acceptance authority", async () => {
    mocks.requireCompanyPermission.mockRejectedValueOnce(
      new AccessError(403, "FORBIDDEN"),
    );
    const response = await POST(request({ rejectionConfirmed: true }), route);
    expect(response.status).toBe(403);
    expect(mocks.rejectBid).not.toHaveBeenCalled();
  });
});
