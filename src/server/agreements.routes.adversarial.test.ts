// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessError } from "./security";

const companyId = "11111111-1111-4111-8111-111111111111";
const agreementId = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  requireAgreementAccess: vi.fn(),
  generateAgreement: vi.fn(),
  readAgreementPdf: vi.fn(),
  getAgreement: vi.fn(),
  updateAgreementDraft: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: companyId }) })),
}));
vi.mock("@/server/company/context", () => ({
  ACTIVE_COMPANY_COOKIE: "trejder_company",
}));
vi.mock("@/server/agreements/access", () => ({
  requireAgreementAccess: mocks.requireAgreementAccess,
}));
vi.mock("@/server/agreements", () => ({
  generateAgreement: mocks.generateAgreement,
  readAgreementPdf: mocks.readAgreementPdf,
  getAgreement: mocks.getAgreement,
  updateAgreementDraft: mocks.updateAgreementDraft,
}));

import { POST as generate } from "@/app/api/agreements/[agreementId]/generate/route";
import { GET as download } from "@/app/api/agreements/[agreementId]/pdf/route";

const route = { params: Promise.resolve({ agreementId }) };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BETTER_AUTH_URL = "https://trejder.test";
  mocks.requireAgreementAccess.mockResolvedValue({
    company: { id: companyId },
    user: { id: "admin-1" },
    membership: { role: "admin" },
  });
  mocks.generateAgreement.mockResolvedValue({ id: agreementId, status: "generated" });
  mocks.readAgreementPdf.mockResolvedValue({
    bytes: new TextEncoder().encode("%PDF-1.7\n%%EOF"),
    fileName: "Trejder_Kopeavtal_ABC123_2026-10-16.pdf",
  });
});

describe("agreement route authorization boundary", () => {
  it("does not generate when the entitlement check rejects the caller", async () => {
    mocks.requireAgreementAccess.mockRejectedValueOnce(
      new AccessError(403, "AGREEMENT_ACCESS_REQUIRED"),
    );
    const response = await generate(
      new Request(`https://trejder.test/api/agreements/${agreementId}/generate`, {
        method: "POST",
        headers: { origin: "https://trejder.test", "content-type": "application/json" },
        body: JSON.stringify({ version: 1 }),
      }),
      route,
    );
    expect(response.status).toBe(403);
    expect(mocks.generateAgreement).not.toHaveBeenCalled();
  });

  it("does not read another company's PDF after fresh access fails", async () => {
    mocks.requireAgreementAccess.mockRejectedValueOnce(
      new AccessError(403, "INVALID_COMPANY_CONTEXT"),
    );
    const response = await download(
      new Request(`https://trejder.test/api/agreements/${agreementId}/pdf`),
      route,
    );
    expect(response.status).toBe(403);
    expect(mocks.readAgreementPdf).not.toHaveBeenCalled();
  });

  it("passes only authenticated tenant and actor identifiers to PDF storage", async () => {
    const response = await download(
      new Request(`https://trejder.test/api/agreements/${agreementId}/pdf`),
      route,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(mocks.readAgreementPdf).toHaveBeenCalledWith({
      companyId,
      actorUserId: "admin-1",
      agreementId,
    });
  });
});
