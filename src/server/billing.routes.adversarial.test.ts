// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "./security";

const mocks = vi.hoisted(() => ({
  requirePlatformAdmin: vi.fn(),
  grantFreeAccess: vi.fn(),
  requireDealerAdminForBilling: vi.fn(),
  createPremiumCheckout: vi.fn(),
  createBillingPortal: vi.fn(),
  selectedCompanyId: "11111111-1111-4111-8111-111111111111",
}));

vi.mock("@/server/platform-admin", () => ({
  requirePlatformAdmin: mocks.requirePlatformAdmin,
}));
vi.mock("@/server/billing", () => ({
  grantFreeAccess: mocks.grantFreeAccess,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: mocks.selectedCompanyId })),
  })),
}));
vi.mock("@/server/company/context", () => ({
  ACTIVE_COMPANY_COOKIE: "trejder_company",
  requireDealerAdminForBilling: mocks.requireDealerAdminForBilling,
}));
vi.mock("@/server/stripe", () => ({
  createPremiumCheckout: mocks.createPremiumCheckout,
  createBillingPortal: mocks.createBillingPortal,
}));

import { POST as grantFree } from "@/app/api/platform/companies/[companyId]/subscription/free/route";
import { POST as createCheckout } from "@/app/api/billing/checkout/route";
import { POST as createPortal } from "@/app/api/billing/portal/route";

const companyId = "11111111-1111-4111-8111-111111111111";
const previousBaseUrl = process.env.BETTER_AUTH_URL;

function request(body: unknown, origin = "https://trejder.example") {
  return new Request(`https://trejder.example/api/platform/companies/${companyId}/subscription/free`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

const route = (id = companyId) => ({ params: Promise.resolve({ companyId: id }) });

describe("platform subscription route adversarial boundary", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = "https://trejder.example";
    mocks.requirePlatformAdmin.mockResolvedValue({ id: "platform-user" });
    mocks.grantFreeAccess.mockResolvedValue({
      freeAccessEndsAt: new Date("2026-11-05T00:00:00.000Z"),
    });
    mocks.requireDealerAdminForBilling.mockResolvedValue({
      company: { id: companyId },
      membership: { role: "admin" },
      user: { id: "dealer-admin" },
    });
    mocks.createPremiumCheckout.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    mocks.createBillingPortal.mockResolvedValue({ url: "https://billing.stripe.test/session" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (previousBaseUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previousBaseUrl;
  });

  it.each(["dealer admin", "trader", "viewer"])("denies a %s without platform authority", async () => {
    mocks.requirePlatformAdmin.mockRejectedValueOnce(
      new AccessError(403, "PLATFORM_ADMIN_REQUIRED"),
    );

    const response = await grantFree(request({ days: 30, mode: "replace" }), route());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "PLATFORM_ADMIN_REQUIRED" });
    expect(mocks.grantFreeAccess).not.toHaveBeenCalled();
  });

  it("passes only the server-authenticated actor and route-owned company to the use case", async () => {
    const response = await grantFree(
      request({ days: 30, mode: "replace", reason: " Introduktion " }),
      route(),
    );

    expect(response.status).toBe(200);
    expect(mocks.grantFreeAccess).toHaveBeenCalledWith({
      actorUserId: "platform-user",
      companyId,
      days: 30,
      mode: "replace",
      reason: "Introduktion",
    });
  });

  it.each([-1, 0, 1.5, 3_651, Number.MAX_SAFE_INTEGER])(
    "rejects invalid free-day input %s before the use case",
    async (days) => {
      const response = await grantFree(request({ days, mode: "replace" }), route());

      expect(response.status).toBe(400);
      expect(mocks.grantFreeAccess).not.toHaveBeenCalled();
    },
  );

  it("rejects an unbounded input shape and a forged actor", async () => {
    const response = await grantFree(
      request({ days: 30, mode: "replace", actorUserId: "attacker", stripeCustomerId: "cus_forged" }),
      route(),
    );

    expect(response.status).toBe(400);
    expect(mocks.grantFreeAccess).not.toHaveBeenCalled();
  });

  it("rejects a forged or malformed company identifier", async () => {
    const response = await grantFree(request({ days: 30, mode: "replace" }), route("not-a-company"));

    expect(response.status).toBe(400);
    expect(mocks.grantFreeAccess).not.toHaveBeenCalled();
  });

  it("rejects cross-origin state changes before authentication or mutation", async () => {
    const response = await grantFree(
      request({ days: 30, mode: "replace" }, "https://attacker.example"),
      route(),
    );

    expect(response.status).toBe(403);
    expect(mocks.requirePlatformAdmin).not.toHaveBeenCalled();
    expect(mocks.grantFreeAccess).not.toHaveBeenCalled();
  });
});

describe("dealer billing route tenant boundary", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = "https://trejder.example";
    mocks.selectedCompanyId = companyId;
    mocks.requireDealerAdminForBilling.mockResolvedValue({
      company: { id: companyId },
      membership: { role: "admin" },
      user: { id: "dealer-admin" },
    });
    mocks.createPremiumCheckout.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    mocks.createBillingPortal.mockResolvedValue({ url: "https://billing.stripe.test/session" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (previousBaseUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previousBaseUrl;
  });

  it.each([
    ["trader", createCheckout],
    ["viewer", createCheckout],
    ["trader", createPortal],
    ["viewer", createPortal],
  ])("denies %s access to a dealer billing action", async (_role, action) => {
    mocks.requireDealerAdminForBilling.mockRejectedValueOnce(
      new AccessError(403, "DEALER_ADMIN_REQUIRED"),
    );

    const response = await action(request({}));

    expect(response.status).toBe(403);
    expect(mocks.createPremiumCheckout).not.toHaveBeenCalled();
    expect(mocks.createBillingPortal).not.toHaveBeenCalled();
  });

  it.each([
    ["checkout", createCheckout, mocks.createPremiumCheckout, [companyId, "dealer-admin"]],
    ["portal", createPortal, mocks.createBillingPortal, [companyId]],
  ] as const)("ignores forged %s billing identity and uses only the authenticated selected company", async (
    _label,
    action,
    useCase,
    expectedArguments,
  ) => {
    const response = await action(request({
      companyId: "22222222-2222-4222-8222-222222222222",
      stripeCustomerId: "cus_attacker",
      price: "price_attacker",
      amount: 1,
    }));

    expect(response.status).toBe(200);
    expect(mocks.requireDealerAdminForBilling).toHaveBeenCalledWith(
      expect.any(Headers),
      companyId,
    );
    expect(useCase).toHaveBeenCalledWith(...expectedArguments);
    expect(useCase).toHaveBeenCalledTimes(1);
  });
});
