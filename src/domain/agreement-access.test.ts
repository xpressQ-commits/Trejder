import { describe, expect, it } from "vitest";
import { canUseAgreementTool } from "./agreement-access";

describe("agreement entitlement", () => {
  it("allows platform administrators and dealer administrators", () => {
    expect(
      canUseAgreementTool({
        isPlatformAdmin: true,
        role: "viewer",
        companyTier: "standard",
      }),
    ).toBe(true);
    expect(
      canUseAgreementTool({
        isPlatformAdmin: false,
        role: "admin",
        companyTier: "standard",
      }),
    ).toBe(true);
  });

  it("models PRO as a company tier, not a role", () => {
    expect(
      canUseAgreementTool({
        isPlatformAdmin: false,
        role: "trader",
        companyTier: "pro",
      }),
    ).toBe(true);
    expect(
      canUseAgreementTool({
        isPlatformAdmin: false,
        role: "viewer",
        companyTier: "standard",
      }),
    ).toBe(false);
    expect(
      canUseAgreementTool({
        isPlatformAdmin: false,
        role: "trader",
        companyTier: "standard",
      }),
    ).toBe(false);
  });

  it("never grants dealer tooling to private customers", () => {
    expect(
      canUseAgreementTool({
        isPlatformAdmin: false,
        role: "private_customer",
        companyTier: "pro",
      }),
    ).toBe(false);
  });
});
